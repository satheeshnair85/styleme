/**
 * Centralized Error Handler
 * Maps backend error codes to user-friendly messages, provides retry functionality,
 * and renders a consistent, accessible error UI (toast/banner).
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4
 */

(function () {
  'use strict';

  // ── Error code → user-friendly message map ──

  var ERROR_MAP = {
    // Design generation errors (from backend DesignErrorCode)
    CONTENT_POLICY_VIOLATION: {
      title: 'Content Not Allowed',
      message: 'Your description was flagged by our content guidelines. Try rephrasing with different words — for example, describe colors, moods, or scenery instead.',
      icon: 'shield',
      dismissable: true,
      showRetry: false,
      suggestions: [
        'Use descriptive words like "calm ocean sunset" or "vibrant city lights"',
        'Focus on colors, emotions, or nature themes',
        'Avoid references to specific people or brands'
      ]
    },
    GENERATION_TIMEOUT: {
      title: 'Taking Too Long',
      message: 'Design generation is taking longer than expected. Your input has been preserved — hit retry to try again.',
      icon: 'clock',
      dismissable: true,
      showRetry: true
    },
    BEDROCK_ERROR: {
      title: 'Service Busy',
      message: 'Our design service is experiencing high demand. Please wait a moment and try again.',
      icon: 'cloud',
      dismissable: true,
      showRetry: true
    },
    S3_UPLOAD_ERROR: {
      title: 'Storage Error',
      message: 'We couldn\'t save your generated design. Please try again.',
      icon: 'cloud',
      dismissable: true,
      showRetry: true
    },
    INVALID_REQUEST: {
      title: 'Invalid Input',
      message: 'Please check your input and try again.',
      icon: 'alert',
      dismissable: true,
      showRetry: false
    },
    INTERNAL_ERROR: {
      title: 'Something Went Wrong',
      message: 'An unexpected error occurred. Please try again in a moment.',
      icon: 'alert',
      dismissable: true,
      showRetry: true
    },

    // Image upload errors (frontend)
    UPLOAD_INVALID_TYPE: {
      title: 'Unsupported File Type',
      message: 'That file format isn\'t supported.',
      icon: 'file',
      dismissable: true,
      showRetry: false,
      suggestions: [
        'Supported formats: PNG, JPEG, WebP',
        'Try converting your image to one of these formats'
      ]
    },
    UPLOAD_TOO_LARGE: {
      title: 'File Too Large',
      message: 'The selected file exceeds the 10MB size limit.',
      icon: 'file',
      dismissable: true,
      showRetry: false,
      suggestions: [
        'Maximum file size: 10MB',
        'Try compressing the image or using a lower resolution'
      ]
    },
    UPLOAD_READ_ERROR: {
      title: 'File Read Failed',
      message: 'We couldn\'t read that file. It may be corrupted or inaccessible.',
      icon: 'file',
      dismissable: true,
      showRetry: false,
      suggestions: [
        'Try selecting the file again',
        'Accepted formats: PNG, JPEG, WebP under 10MB'
      ]
    },
    UPLOAD_NETWORK_ERROR: {
      title: 'Upload Failed',
      message: 'The upload failed due to a network issue. Please check your connection and try again.',
      icon: 'wifi',
      dismissable: true,
      showRetry: true
    },

    // Generic network error
    NETWORK_ERROR: {
      title: 'Connection Problem',
      message: 'Unable to reach our servers. Please check your internet connection and try again.',
      icon: 'wifi',
      dismissable: true,
      showRetry: true
    }
  };

  // ── SVG icon paths ──

  var ICONS = {
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    cloud: '<path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>',
    alert: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    file: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    wifi: '<path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
    close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
  };

  // ── Toast container (singleton) ──

  var toastContainer = null;
  var activeToasts = [];
  var toastIdCounter = 0;

  function getToastContainer() {
    if (toastContainer) return toastContainer;

    toastContainer = document.createElement('div');
    toastContainer.className = 'error-toast-container';
    toastContainer.setAttribute('aria-live', 'polite');
    toastContainer.setAttribute('aria-atomic', 'false');
    toastContainer.setAttribute('role', 'status');
    document.body.appendChild(toastContainer);
    return toastContainer;
  }

  /**
   * Build the SVG icon element
   * @param {string} iconName
   * @returns {string} SVG markup
   */
  function buildIcon(iconName) {
    var path = ICONS[iconName] || ICONS.alert;
    return '<svg class="error-toast__icon-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }

  /**
   * Show an error toast/banner
   * @param {string} code - Error code from ERROR_MAP
   * @param {Object} [options] - Override options
   * @param {string} [options.message] - Override message
   * @param {Function} [options.onRetry] - Retry callback
   * @param {string} [options.context] - Additional context (e.g. file size)
   * @param {number} [options.autoDismissMs] - Auto-dismiss after ms (0 = never)
   * @returns {Object} Toast handle with { id, dismiss }
   */
  function showError(code, options) {
    options = options || {};

    var config = ERROR_MAP[code] || ERROR_MAP.INTERNAL_ERROR;
    var id = ++toastIdCounter;

    var message = options.message || config.message;
    if (options.context) {
      message = message + ' ' + options.context;
    }

    var container = getToastContainer();

    // Build toast HTML
    var toast = document.createElement('div');
    toast.className = 'error-toast error-toast--' + (config.icon || 'alert');
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('data-toast-id', id);

    var html = '<div class="error-toast__icon">' + buildIcon(config.icon || 'alert') + '</div>';
    html += '<div class="error-toast__body">';
    html += '<div class="error-toast__title">' + escapeHtml(config.title) + '</div>';
    html += '<div class="error-toast__message">' + escapeHtml(message) + '</div>';

    // Suggestions list
    if (config.suggestions && config.suggestions.length > 0) {
      html += '<ul class="error-toast__suggestions">';
      config.suggestions.forEach(function (s) {
        html += '<li>' + escapeHtml(s) + '</li>';
      });
      html += '</ul>';
    }

    // Action buttons
    if ((config.showRetry && options.onRetry) || config.dismissable) {
      html += '<div class="error-toast__actions">';
      if (config.showRetry && options.onRetry) {
        html += '<button type="button" class="error-toast__btn error-toast__btn--retry" data-action="retry">Try Again</button>';
      }
      html += '</div>';
    }

    html += '</div>'; // close body

    if (config.dismissable) {
      html += '<button type="button" class="error-toast__close" data-action="dismiss" aria-label="Dismiss error">';
      html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' + ICONS.close + '</svg>';
      html += '</button>';
    }

    toast.innerHTML = html;

    // Bind events
    var retryBtn = toast.querySelector('[data-action="retry"]');
    if (retryBtn && options.onRetry) {
      retryBtn.addEventListener('click', function () {
        dismissToast(id);
        options.onRetry();
      });
    }

    var closeBtn = toast.querySelector('[data-action="dismiss"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        dismissToast(id);
      });
    }

    container.appendChild(toast);

    // Trigger entrance animation
    requestAnimationFrame(function () {
      toast.classList.add('error-toast--visible');
    });

    var handle = { id: id, dismiss: function () { dismissToast(id); } };
    activeToasts.push(handle);

    // Auto-dismiss (default 10s, 0 to disable)
    var autoDismiss = options.autoDismissMs !== undefined ? options.autoDismissMs : 10000;
    if (autoDismiss > 0) {
      setTimeout(function () { dismissToast(id); }, autoDismiss);
    }

    return handle;
  }

  /**
   * Dismiss a toast by ID
   * @param {number} id
   */
  function dismissToast(id) {
    var container = getToastContainer();
    var toast = container.querySelector('[data-toast-id="' + id + '"]');
    if (!toast) return;

    toast.classList.remove('error-toast--visible');
    toast.classList.add('error-toast--exiting');

    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
      activeToasts = activeToasts.filter(function (t) { return t.id !== id; });
    }, 300);
  }

  /**
   * Dismiss all active toasts
   */
  function dismissAll() {
    activeToasts.slice().forEach(function (t) { t.dismiss(); });
  }

  /**
   * Show an inline error in a specific DOM element (for form-level errors)
   * @param {HTMLElement} el - The error display element
   * @param {string} code - Error code
   * @param {Object} [options] - Override options
   */
  function showInlineError(el, code, options) {
    if (!el) return;
    options = options || {};

    var config = ERROR_MAP[code] || ERROR_MAP.INTERNAL_ERROR;
    var message = options.message || config.message;

    var html = '<span class="error-inline__text">' + escapeHtml(message) + '</span>';

    if (config.suggestions && config.suggestions.length > 0) {
      html += '<ul class="error-inline__suggestions">';
      config.suggestions.forEach(function (s) {
        html += '<li>' + escapeHtml(s) + '</li>';
      });
      html += '</ul>';
    }

    el.innerHTML = html;
    el.removeAttribute('hidden');
    el.classList.add('error-inline--visible');
  }

  /**
   * Hide an inline error
   * @param {HTMLElement} el
   */
  function hideInlineError(el) {
    if (!el) return;
    el.innerHTML = '';
    el.setAttribute('hidden', '');
    el.classList.remove('error-inline--visible');
  }

  /**
   * Parse an API error response and return the appropriate error code
   * @param {Error|Object} error - The caught error
   * @returns {string} Error code
   */
  function parseApiError(error) {
    // Check for structured API error response
    if (error && error.code && ERROR_MAP[error.code]) {
      return error.code;
    }

    var msg = (error && error.message) ? error.message.toLowerCase() : '';

    if (error && error.name === 'AbortError') return 'GENERATION_TIMEOUT';
    if (msg.includes('timeout') || msg.includes('timed out')) return 'GENERATION_TIMEOUT';
    if (msg.includes('content') || msg.includes('policy') || msg.includes('filter') || msg.includes('inappropriate')) return 'CONTENT_POLICY_VIOLATION';
    if (msg.includes('throttl') || msg.includes('rate') || msg.includes('429') || msg.includes('toomanyrequests')) return 'BEDROCK_ERROR';
    if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('fetch')) return 'NETWORK_ERROR';
    if (msg.includes('s3') || msg.includes('upload') || msg.includes('storage')) return 'S3_UPLOAD_ERROR';

    return 'INTERNAL_ERROR';
  }

  /**
   * Parse an image upload error and return the appropriate error code
   * @param {File} file - The file that failed
   * @param {string} [reason] - Specific reason string
   * @returns {string} Error code
   */
  function parseUploadError(file, reason) {
    if (reason === 'invalid_type') return 'UPLOAD_INVALID_TYPE';
    if (reason === 'too_large') return 'UPLOAD_TOO_LARGE';
    if (reason === 'read_error') return 'UPLOAD_READ_ERROR';
    if (reason === 'network') return 'UPLOAD_NETWORK_ERROR';
    return 'UPLOAD_READ_ERROR';
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ── Public API ──

  window.ErrorHandler = {
    show: showError,
    dismiss: dismissToast,
    dismissAll: dismissAll,
    showInline: showInlineError,
    hideInline: hideInlineError,
    parseApiError: parseApiError,
    parseUploadError: parseUploadError,
    ERROR_MAP: ERROR_MAP
  };
})();
