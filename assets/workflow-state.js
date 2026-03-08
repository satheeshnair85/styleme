/**
 * Workflow State Manager
 * Manages the 4-step customization workflow state using sessionStorage.
 * Steps: 1=Mood Input, 2=Design Generation, 3=Product Selection, 4=Design Application
 *
 * Requirements: 2.3, 2.5, 8.6, 8.7, 8.8, 8.9, 8.10
 */

class WorkflowStateManager {
  /** @type {string} */
  static STORAGE_KEY = 'ai_merch_workflow';

  /** @type {number} Session timeout in ms (30 minutes) */
  static SESSION_TIMEOUT = 30 * 60 * 1000;

  /** @type {number} Warning threshold in ms (25 minutes) */
  static TIMEOUT_WARNING = 25 * 60 * 1000;

  /** @type {Object} Step metadata */
  static STEPS = {
    1: { label: 'Mood Input', requiredFields: [] },
    2: { label: 'Design Generation', requiredFields: ['moodInput'] },
    3: { label: 'Product Selection', requiredFields: ['selectedDesign'] },
    4: { label: 'Design Application', requiredFields: ['selectedProduct'] }
  };

  constructor() {
    this._timeoutWarningTimer = null;
    this._timeoutExpireTimer = null;
    this.state = this._load();
    this._bindEvents();
    this._startTimeoutTimers();
  }

  /**
   * Get the current workflow state
   * @returns {Object} Current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Get the current step number
   * @returns {number}
   */
  getCurrentStep() {
    return this.state.currentStep;
  }

  /**
   * Get the session ID
   * @returns {string}
   */
  getSessionId() {
    return this.state.sessionId;
  }

  /**
   * Navigate to a specific step if allowed
   * @param {number} step - Target step (1-4)
   * @returns {boolean} Whether navigation succeeded
   */
  goToStep(step) {
    if (step < 1 || step > 4) return false;

    // Going backward is always allowed (Req 8.7)
    if (step < this.state.currentStep) {
      this.state.currentStep = step;
      this._save();
      this.syncHashToStep();
      this._emitChange();
      return true;
    }

    // Going forward requires validation (Req 8.9)
    if (step > this.state.currentStep) {
      // Can only advance one step at a time
      if (step !== this.state.currentStep + 1) return false;
      if (!this.canAdvance()) return false;
      this.state.currentStep = step;
      this._save();
      this.syncHashToStep();
      this._emitChange();
      return true;
    }

    return true; // Same step
  }

  /**
   * Check if the user can advance to the next step
   * @returns {boolean}
   */
  canAdvance() {
    const nextStep = this.state.currentStep + 1;
    if (nextStep > 4) return false;

    const required = WorkflowStateManager.STEPS[nextStep].requiredFields;
    return required.every(field => {
      const val = this.state[field];
      return val !== null && val !== undefined && val !== '';
    });
  }

  /**
   * Check if the user can go back
   * @returns {boolean}
   */
  canGoBack() {
    return this.state.currentStep > 1;
  }

  /**
   * Set mood input data (text prompt or image reference)
   * @param {string|null} text - Text prompt
   * @param {string|null} image - Uploaded image reference (data URL or S3 URL)
   */
  setMoodInput(text, image) {
    this.state.moodInput = text || null;
    this.state.uploadedImage = image || null;
    this._save();
  }

  /**
   * Set the generated designs array (3 variations)
   * @param {Array|null} designs - Array of design objects
   */
  setGeneratedDesigns(designs) {
    this.state.generatedDesigns = designs;
    this._save();
  }

  /**
   * Set the selected design from the 3 generated variations
   * @param {Object|null} design - Selected design object { id, s3Url, thumbnailUrl }
   */
  setSelectedDesign(design) {
    this.state.selectedDesign = design;
    this._save();
  }

  /**
   * Set the selected product variant
   * @param {Object|null} product - Selected product { sku, name, type, variant }
   */
  setSelectedProduct(product) {
    this.state.selectedProduct = product;
    this._save();
  }

  /**
   * Reset the workflow to step 1
   */
  reset() {
    this.state = this._defaultState();
    this._save();
    this._emitChange();
  }

  /**
   * Get validation errors for advancing from the current step
   * @returns {string[]} Array of error messages (empty if valid)
   */
  getValidationErrors() {
    const errors = [];
    const step = this.state.currentStep;

    if (step === 1) {
      if (!this.state.moodInput && !this.state.uploadedImage) {
        errors.push('Please describe your mood or upload an image to continue.');
      }
    } else if (step === 2) {
      if (!this.state.selectedDesign) {
        errors.push('Please select a design to continue.');
      }
    } else if (step === 3) {
      if (!this.state.selectedProduct) {
        errors.push('Please select a product to continue.');
      }
    }

    return errors;
  }

  /**
   * Mark the workflow as completed (e.g. after add-to-cart in Step 4)
   */
  markCompleted() {
    this.state.completedAt = Date.now();
    this._save();
    this._clearTimeoutTimers();
    this._emitEvent('workflow:completed', { sessionId: this.state.sessionId });
  }

  /**
   * Check if the workflow has been completed
   * @returns {boolean}
   */
  isCompleted() {
    return !!this.state.completedAt;
  }

  /**
   * Extend the session by resetting the activity timestamp.
   * Called when user clicks "Keep working" on the timeout warning.
   */
  extendSession() {
    this.state.lastActivity = Date.now();
    this._save();
    this._startTimeoutTimers();
    this._emitEvent('workflow:session-extended', {});
  }

  /**
   * Sync the current step to the URL hash (e.g. #step-2)
   * so browser back/forward navigates between steps.
   */
  syncHashToStep() {
    var hash = '#step-' + this.state.currentStep;
    if (window.location.hash !== hash) {
      history.pushState(null, '', hash);
    }
  }

  /**
   * Read the step from the URL hash, if present.
   * @returns {number|null} Step number or null if no valid hash
   */
  static stepFromHash() {
    var match = window.location.hash.match(/^#step-([1-4])$/);
    return match ? parseInt(match[1], 10) : null;
  }

  // ── Private methods ──

  /**
   * Load state from sessionStorage or create default
   * @returns {Object}
   */
  _load() {
    try {
      const raw = sessionStorage.getItem(WorkflowStateManager.STORAGE_KEY);
      if (!raw) return this._defaultState();

      const saved = JSON.parse(raw);

      // Check session timeout (Req 8.10)
      if (Date.now() - saved.lastActivity > WorkflowStateManager.SESSION_TIMEOUT) {
        sessionStorage.removeItem(WorkflowStateManager.STORAGE_KEY);
        return this._defaultState();
      }

      // Refresh activity timestamp
      saved.lastActivity = Date.now();
      return saved;
    } catch (e) {
      console.warn('[WorkflowState] Failed to load state:', e);
      return this._defaultState();
    }
  }

  /**
   * Save current state to sessionStorage
   */
  _save() {
    try {
      this.state.lastActivity = Date.now();
      sessionStorage.setItem(
        WorkflowStateManager.STORAGE_KEY,
        JSON.stringify(this.state)
      );
    } catch (e) {
      console.warn('[WorkflowState] Failed to save state:', e);
    }
  }

  /**
   * Create default state
   * @returns {Object}
   */
  _defaultState() {
    return {
      currentStep: 1,
      moodInput: null,
      uploadedImage: null,
      generatedDesigns: null,
      selectedDesign: null,
      selectedProduct: null,
      sessionId: this._generateId(),
      createdAt: Date.now(),
      lastActivity: Date.now()
    };
  }

  /**
   * Generate a unique session ID
   * @returns {string}
   */
  _generateId() {
    return 'wf_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }

  /**
   * Emit a custom event when state changes so UI can react
   * @param {string} name - Event name
   * @param {Object} detail - Event detail payload
   */
  _emitEvent(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail: detail }));
  }

  /**
   * Emit step change event (backward-compatible)
   */
  _emitChange() {
    this._emitEvent('workflow:stepchange', {
      step: this.state.currentStep,
      state: this.getState()
    });
  }

  /**
   * Start (or restart) the session timeout warning and expiry timers.
   */
  _startTimeoutTimers() {
    this._clearTimeoutTimers();

    var elapsed = Date.now() - this.state.lastActivity;
    var warningDelay = Math.max(0, WorkflowStateManager.TIMEOUT_WARNING - elapsed);
    var expireDelay = Math.max(0, WorkflowStateManager.SESSION_TIMEOUT - elapsed);

    var self = this;

    this._timeoutWarningTimer = setTimeout(function () {
      self._emitEvent('workflow:timeout-warning', {
        expiresIn: WorkflowStateManager.SESSION_TIMEOUT - WorkflowStateManager.TIMEOUT_WARNING
      });
    }, warningDelay);

    this._timeoutExpireTimer = setTimeout(function () {
      self.reset();
      self._emitEvent('workflow:session-expired', {});
    }, expireDelay);
  }

  /**
   * Clear timeout timers (e.g. on reset or completion)
   */
  _clearTimeoutTimers() {
    if (this._timeoutWarningTimer) {
      clearTimeout(this._timeoutWarningTimer);
      this._timeoutWarningTimer = null;
    }
    if (this._timeoutExpireTimer) {
      clearTimeout(this._timeoutExpireTimer);
      this._timeoutExpireTimer = null;
    }
  }

  /**
   * Bind browser events for session persistence and hash navigation
   */
  _bindEvents() {
    var self = this;

    // Re-load on bfcache restore
    window.addEventListener('pageshow', function () {
      self.state = self._load();
      self._emitChange();
      self._startTimeoutTimers();
    });

    // Save state before navigating away (Req 2.5)
    window.addEventListener('beforeunload', function () {
      self._save();
    });

    // Save state when tab becomes hidden (Req 2.5)
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        self._save();
      } else if (document.visibilityState === 'visible') {
        // Re-check timeout when user returns
        self.state = self._load();
        self._emitChange();
        self._startTimeoutTimers();
      }
    });

    // Handle browser back/forward via hash changes
    window.addEventListener('popstate', function () {
      var hashStep = WorkflowStateManager.stepFromHash();
      if (hashStep && hashStep !== self.state.currentStep) {
        // Only allow navigating backward via hash
        if (hashStep < self.state.currentStep) {
          self.state.currentStep = hashStep;
          self._save();
          self._emitChange();
        } else if (hashStep > self.state.currentStep && self.canAdvance()) {
          // Allow forward only if validation passes
          if (hashStep === self.state.currentStep + 1) {
            self.state.currentStep = hashStep;
            self._save();
            self._emitChange();
          }
        }
      }
    });
  }
}

// ── Singleton instance ──
window.workflowState = new WorkflowStateManager();
