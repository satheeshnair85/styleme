/**
 * Design Generation Controller
 * Handles API calls to generate designs, loading states, progress feedback,
 * design display, and selection interface.
 *
 * Requirements: 5.6, 5.7, 8.3, 8.4
 */

(function () {
  'use strict';

  // Configuration - Use theme settings if available, fallback to defaults
  var config = window.aiConfig || {};
  var API_BASE_URL = config.apiEndpoint || 'https://api-placeholder.example.com';
  var API_KEY = config.apiKey || '';
  var GENERATION_TIMEOUT = config.generationTimeout || 60000; // 60 seconds
  var DEBUG_MODE = config.debugMode || false;
  var PROGRESS_INTERVAL = 500; // Update progress every 500ms

  // DOM references
  var loadingSection = document.getElementById('design-loading');
  var loadingMessage = document.getElementById('loading-message');
  var progressFill = document.getElementById('progress-fill');
  var designsGrid = document.getElementById('designs-grid');
  var errorSection = document.getElementById('design-error');
  var errorTitle = document.getElementById('error-title');
  var errorMessage = document.getElementById('error-message');
  var retryBtn = document.getElementById('retry-btn');
  var regenerateBtn = document.getElementById('regenerate-btn');

  // Design card elements
  var designCards = document.querySelectorAll('.design-card');
  var designImages = [
    document.getElementById('design-img-0'),
    document.getElementById('design-img-1'),
    document.getElementById('design-img-2')
  ];

  // State
  var currentDesigns = null;
  var selectedDesignIndex = null;
  var isGenerating = false;
  var progressTimer = null;
  var currentProgress = 0;

  /**
   * Initialize the design generation component
   */
  function init() {
    if (DEBUG_MODE) {
      console.log('[AI Debug] Design generation component initializing...');
      console.log('[AI Debug] Configuration:', {
        apiEndpoint: API_BASE_URL,
        apiKey: API_KEY ? API_KEY.substring(0, 10) + '...' : 'NOT SET',
        timeout: GENERATION_TIMEOUT,
        debugMode: DEBUG_MODE
      });
    }
    
    bindEvents();
    checkForExistingDesigns();
  }

  /**
   * Bind event listeners
   */
  function bindEvents() {
    // Design card selection
    designCards.forEach(function (card, index) {
      card.addEventListener('click', function () {
        selectDesign(index);
      });

      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectDesign(index);
        }
      });
    });

    // Regenerate button
    if (regenerateBtn) {
      regenerateBtn.addEventListener('click', function () {
        regenerateDesigns();
      });
    }

    // Retry button
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        generateDesigns();
      });
    }

    // Listen for workflow step changes
    document.addEventListener('workflow:stepchange', function (e) {
      if (e.detail.step === 2) {
        handleStepActivation();
      }
    });
  }

  /**
   * Check if designs already exist in workflow state
   */
  function checkForExistingDesigns() {
    var wf = window.workflowState;
    if (!wf) return;

    var state = wf.getState();
    if (state.generatedDesigns && state.generatedDesigns.length === 3) {
      currentDesigns = state.generatedDesigns;
      displayDesigns(currentDesigns);
      
      // Restore selection if exists
      if (state.selectedDesign) {
        var index = currentDesigns.findIndex(function (d) {
          return d.id === state.selectedDesign.id;
        });
        if (index !== -1) {
          selectDesign(index, true);
        }
      }
    }
  }

  /**
   * Handle when Step 2 becomes active
   */
  function handleStepActivation() {
    var wf = window.workflowState;
    if (!wf) {
      console.error('[DesignGeneration] WorkflowState not available');
      return;
    }

    var state = wf.getState();
    
    if (DEBUG_MODE) {
      console.log('[AI Debug] Step 2 activated, current state:', state);
    }
    
    // If no designs exist yet, start generation
    if (!state.generatedDesigns || state.generatedDesigns.length === 0) {
      if (DEBUG_MODE) {
        console.log('[AI Debug] No existing designs, starting generation...');
      }
      generateDesigns();
    } else {
      if (DEBUG_MODE) {
        console.log('[AI Debug] Existing designs found, displaying them');
      }
    }
  }

  /**
   * Generate designs via API
   */
  function generateDesigns() {
    if (isGenerating) return;

    var wf = window.workflowState;
    if (!wf) {
      showError('System Error', 'Workflow state manager not initialized.');
      return;
    }

    var state = wf.getState();
    
    // Validate input
    if (!state.moodInput && !state.uploadedImage) {
      showError('Missing Input', 'Please provide a mood description or upload an image first.');
      return;
    }

    isGenerating = true;
    showLoading();
    startProgressSimulation();

    // Prepare request payload - match backend API format
    var payload = {
      prompt: state.uploadedImage ? 'Custom uploaded image design' : state.moodInput,
      productType: state.selectedProduct ? state.selectedProduct.type : 'tshirt',
      userId: null, // For now, treat all users as anonymous
      style: 'standard'
    };

    if (DEBUG_MODE) {
      console.log('[AI Debug] Generating designs with payload:', payload);
    }

    // Make API call
    fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': API_KEY
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(GENERATION_TIMEOUT)
    })
      .then(function (response) {
        if (!response.ok) {
          return response.json().then(function (err) {
            // Preserve the structured error from the backend
            var apiErr = new Error(err.error ? (err.error.message || 'Generation failed') : 'Generation failed');
            if (err.error) {
              apiErr.apiError = err.error;
            }
            throw apiErr;
          }).catch(function (parseErr) {
            // If JSON parsing fails, re-throw with status info
            if (parseErr.apiError) throw parseErr;
            throw new Error('Server error (' + response.status + ')');
          });
        }
        return response.json();
      })
      .then(function (data) {
        stopProgressSimulation();
        isGenerating = false;

        if (DEBUG_MODE) {
          console.log('[AI Debug] API Response:', data);
        }

        if (data.success && data.data && data.data.designUrl) {
          // Backend returns single design, but frontend expects 3 designs
          // Generate 3 variations by calling API 3 times or create mock variations
          handleSingleDesignSuccess(data.data);
        } else {
          throw new Error('Invalid response format');
        }
      })
      .catch(function (error) {
        stopProgressSimulation();
        isGenerating = false;
        handleGenerationError(error);
      });
  }

  /**
   * Handle successful single design generation and create variations
   * @param {Object} designData - Single design data from backend
   */
  function handleSingleDesignSuccess(designData) {
    // For now, create 3 copies of the same design with different IDs
    // In the future, this could call the API 3 times for variations
    var designs = [];
    for (var i = 0; i < 3; i++) {
      designs.push({
        id: designData.designId + '_' + i,
        s3Url: designData.designUrl,
        thumbnailUrl: designData.designUrl, // Same URL for now
        prompt: designData.prompt,
        productType: designData.productType
      });
    }
    
    handleGenerationSuccess(designs);
  }

  /**
   * Handle successful design generation
   * @param {Array} designs - Array of design objects
   */
  function handleGenerationSuccess(designs) {
    if (!designs || designs.length !== 3) {
      showError('Invalid Response', 'Expected 3 designs but received ' + (designs ? designs.length : 0));
      return;
    }

    currentDesigns = designs;
    
    // Store in workflow state
    var wf = window.workflowState;
    if (wf) {
      wf.setGeneratedDesigns(designs);
    }

    displayDesigns(designs);
  }

  /**
   * Handle generation error using centralized ErrorHandler
   * @param {Error} error
   */
  function handleGenerationError(error) {
    console.error('[DesignGeneration] Error:', error);

    // Try to extract structured error from API response
    var errorCode = 'INTERNAL_ERROR';
    var apiError = null;

    if (error && error.apiError) {
      // Structured error from our API
      apiError = error.apiError;
      errorCode = apiError.code || 'INTERNAL_ERROR';
    } else if (window.ErrorHandler) {
      errorCode = window.ErrorHandler.parseApiError(error);
    } else {
      // Fallback without ErrorHandler
      if (error.name === 'AbortError' || (error.message && error.message.includes('timeout'))) {
        errorCode = 'GENERATION_TIMEOUT';
      } else if (error.message && (error.message.includes('content policy') || error.message.includes('inappropriate'))) {
        errorCode = 'CONTENT_POLICY_VIOLATION';
      }
    }

    // Show error via centralized handler (toast) + inline section
    if (window.ErrorHandler) {
      var config = window.ErrorHandler.ERROR_MAP[errorCode] || window.ErrorHandler.ERROR_MAP.INTERNAL_ERROR;

      // Show toast notification
      window.ErrorHandler.show(errorCode, {
        onRetry: config.showRetry ? generateDesigns : undefined,
        autoDismissMs: 0 // Don't auto-dismiss generation errors
      });

      // Also update the inline error section for the design generation area
      showInlineErrorState(errorCode, config);
    } else {
      // Fallback: use the old inline error display
      showError('Something Went Wrong', 'An unexpected error occurred. Please try again.');
    }
  }

  /**
   * Show the inline error state in the design generation section
   * Uses ErrorHandler config for consistent messaging
   * @param {string} errorCode
   * @param {Object} config - ErrorHandler config for this code
   */
  function showInlineErrorState(errorCode, config) {
    hideLoading();
    designsGrid.setAttribute('hidden', '');

    errorTitle.textContent = config.title;

    // Build message with suggestions if available
    var messageHtml = config.message;
    errorMessage.textContent = messageHtml;

    // Show/hide retry button based on error type
    if (retryBtn) {
      if (config.showRetry) {
        retryBtn.removeAttribute('hidden');
        retryBtn.textContent = 'Try Again';
      } else {
        retryBtn.setAttribute('hidden', '');
      }
    }

    // Add suggestions below the error message if content policy violation
    var existingSuggestions = errorSection.querySelector('.design-generation__error-suggestions');
    if (existingSuggestions) existingSuggestions.remove();

    if (config.suggestions && config.suggestions.length > 0) {
      var sugList = document.createElement('ul');
      sugList.className = 'design-generation__error-suggestions';
      config.suggestions.forEach(function (s) {
        var li = document.createElement('li');
        li.textContent = s;
        sugList.appendChild(li);
      });
      errorMessage.parentNode.insertBefore(sugList, retryBtn ? retryBtn : null);
    }

    // For content policy violations, add a "Modify Description" button
    var existingModifyBtn = errorSection.querySelector('.design-generation__modify-btn');
    if (existingModifyBtn) existingModifyBtn.remove();

    if (errorCode === 'CONTENT_POLICY_VIOLATION') {
      var modifyBtn = document.createElement('button');
      modifyBtn.type = 'button';
      modifyBtn.className = 'btn btn-secondary design-generation__modify-btn';
      modifyBtn.textContent = 'Modify Description';
      modifyBtn.addEventListener('click', function () {
        // Navigate back to Step 1 so user can change their input
        var wf = window.workflowState;
        if (wf) {
          wf.goToStep(1);
        }
      });
      errorSection.appendChild(modifyBtn);
    }

    errorSection.removeAttribute('hidden');
  }

  /**
   * Display the 3 generated designs
   * @param {Array} designs
   */
  function displayDesigns(designs) {
    hideLoading();
    hideError();

    // Set design images with performance-optimized loading (Req 16.3)
    designs.forEach(function (design, index) {
      if (designImages[index]) {
        if (window.MobilePerformance) {
          window.MobilePerformance.loadDesignImage(
            designImages[index],
            design.thumbnailUrl || design.s3Url,
            'designPreview'
          );
        } else {
          designImages[index].src = design.thumbnailUrl || design.s3Url;
        }
        designImages[index].alt = 'Generated design ' + (index + 1);
      }
    });

    // Show designs grid
    designsGrid.removeAttribute('hidden');
  }

  /**
   * Select a design
   * @param {number} index - Design index (0-2)
   * @param {boolean} skipStateUpdate - Skip updating workflow state (for restoration)
   */
  function selectDesign(index, skipStateUpdate) {
    if (!currentDesigns || !currentDesigns[index]) return;

    selectedDesignIndex = index;

    // Update UI
    designCards.forEach(function (card, i) {
      if (i === index) {
        card.classList.add('design-card--selected');
        card.setAttribute('aria-pressed', 'true');
      } else {
        card.classList.remove('design-card--selected');
        card.setAttribute('aria-pressed', 'false');
      }
    });

    // Update workflow state
    if (!skipStateUpdate) {
      var wf = window.workflowState;
      if (wf) {
        wf.setSelectedDesign(currentDesigns[index]);
        
        // Emit custom event for other components
        document.dispatchEvent(new CustomEvent('design:selected', {
          detail: { design: currentDesigns[index], index: index }
        }));
      }
    }
  }

  /**
   * Regenerate designs (same input, new variations)
   */
  function regenerateDesigns() {
    if (isGenerating) return;

    // Clear current selection
    selectedDesignIndex = null;
    designCards.forEach(function (card) {
      card.classList.remove('design-card--selected');
      card.setAttribute('aria-pressed', 'false');
    });

    var wf = window.workflowState;
    if (wf) {
      wf.setSelectedDesign(null);
    }

    // Generate new designs
    generateDesigns();
  }

  /**
   * Show loading state
   */
  function showLoading() {
    hideError();
    designsGrid.setAttribute('hidden', '');
    loadingSection.removeAttribute('hidden');
    currentProgress = 0;
    setProgress(0);
  }

  /**
   * Hide loading state
   */
  function hideLoading() {
    loadingSection.setAttribute('hidden', '');
  }

  /**
   * Show error state
   * @param {string} title
   * @param {string} message
   */
  function showError(title, message) {
    hideLoading();
    designsGrid.setAttribute('hidden', '');
    
    errorTitle.textContent = title;
    errorMessage.textContent = message;
    errorSection.removeAttribute('hidden');
  }

  /**
   * Hide error state
   */
  function hideError() {
    errorSection.setAttribute('hidden', '');
  }

  /**
   * Start simulated progress animation
   */
  function startProgressSimulation() {
    currentProgress = 0;
    setProgress(0);

    progressTimer = setInterval(function () {
      // Simulate progress: fast at first, then slow down
      if (currentProgress < 30) {
        currentProgress += 2;
      } else if (currentProgress < 60) {
        currentProgress += 1;
      } else if (currentProgress < 90) {
        currentProgress += 0.5;
      }

      setProgress(Math.min(currentProgress, 95));

      // Update loading message based on progress
      if (currentProgress < 30) {
        loadingMessage.textContent = 'Analyzing your input...';
      } else if (currentProgress < 60) {
        loadingMessage.textContent = 'Generating unique designs...';
      } else {
        loadingMessage.textContent = 'Finalizing your designs...';
      }
    }, PROGRESS_INTERVAL);
  }

  /**
   * Stop progress simulation
   */
  function stopProgressSimulation() {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
    setProgress(100);
  }

  /**
   * Set progress bar percentage
   * @param {number} percent - Progress percentage (0-100)
   */
  function setProgress(percent) {
    if (progressFill) {
      progressFill.style.width = percent + '%';
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for testing/debugging
  window.designGeneration = {
    generateDesigns: generateDesigns,
    regenerateDesigns: regenerateDesigns,
    selectDesign: selectDesign,
    getCurrentDesigns: function () { return currentDesigns; },
    getSelectedIndex: function () { return selectedDesignIndex; }
  };
})();
