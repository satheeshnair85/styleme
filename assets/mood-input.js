/**
 * Mood Input Controller
 * Handles text prompt validation, image upload with drag-and-drop,
 * file validation, preview, and integration with WorkflowStateManager.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 22.9
 */

(function () {
  'use strict';

  var MIN_CHARS = 3;
  var MAX_CHARS = 500;
  var MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  var ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

  // DOM references
  var textarea = document.getElementById('mood-text');
  var charCurrent = document.getElementById('mood-char-current');
  var charCount = document.getElementById('mood-char-count');
  var textError = document.getElementById('mood-text-error');
  var dropzone = document.getElementById('mood-dropzone');
  var dropzoneContent = document.getElementById('dropzone-content');
  var preview = document.getElementById('mood-preview');
  var previewImg = document.getElementById('mood-preview-img');
  var removeBtn = document.getElementById('mood-remove-img');
  var fileInput = document.getElementById('mood-file-input');
  var cameraInput = document.getElementById('mood-camera-input');
  var cameraBtn = document.getElementById('mood-camera-btn');
  var progressWrap = document.getElementById('mood-progress');
  var progressBar = document.getElementById('mood-progress-bar');
  var progressText = document.getElementById('mood-progress-text');
  var fileError = document.getElementById('mood-file-error');

  // Current uploaded image data URL
  var currentImageData = null;

  // ── Text Input ──

  function updateCharCounter() {
    var len = textarea.value.length;
    charCurrent.textContent = len;

    charCount.classList.remove('mood-input__counter--warn', 'mood-input__counter--over');
    if (len > MAX_CHARS) {
      charCount.classList.add('mood-input__counter--over');
    } else if (len > MAX_CHARS * 0.9) {
      charCount.classList.add('mood-input__counter--warn');
    }
  }

  function validateText() {
    var text = textarea.value.trim();
    var len = text.length;

    hideError(textError);
    textarea.classList.remove('mood-input__textarea--error');

    if (len === 0) {
      // Empty is fine — user might use image instead
      syncState();
      return true;
    }

    if (len < MIN_CHARS) {
      showError(textError, 'Please enter at least ' + MIN_CHARS + ' characters.');
      textarea.classList.add('mood-input__textarea--error');
      syncState();
      return false;
    }

    if (len > MAX_CHARS) {
      showError(textError, 'Maximum ' + MAX_CHARS + ' characters allowed.');
      textarea.classList.add('mood-input__textarea--error');
      syncState();
      return false;
    }

    syncState();
    return true;
  }

  textarea.addEventListener('input', function () {
    // Enforce max length
    if (textarea.value.length > MAX_CHARS) {
      textarea.value = textarea.value.slice(0, MAX_CHARS);
    }
    updateCharCounter();
    validateText();
  });

  textarea.addEventListener('blur', function () {
    validateText();
  });

  // ── Image Upload ──

  /**
   * Validate a file before processing.
   * Returns an object { valid, errorCode } so the centralized ErrorHandler
   * can display the right message with suggestions.
   * @param {File} file
   * @returns {{ valid: boolean, errorCode: string|null }}
   */
  function validateFile(file) {
    if (!file) return { valid: false, errorCode: 'UPLOAD_READ_ERROR' };

    if (ALLOWED_TYPES.indexOf(file.type) === -1) {
      return { valid: false, errorCode: 'UPLOAD_INVALID_TYPE' };
    }

    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, errorCode: 'UPLOAD_TOO_LARGE' };
    }

    return { valid: true, errorCode: null };
  }

  /**
   * Process a valid file: read it, show preview, update state
   * @param {File} file
   */
  function processFile(file) {
    var result = validateFile(file);
    if (!result.valid) {
      // Use centralized ErrorHandler for inline + toast display
      if (window.ErrorHandler) {
        window.ErrorHandler.showInline(fileError, result.errorCode);
        window.ErrorHandler.show(result.errorCode);
      } else {
        showError(fileError, 'File validation failed. Please try a different file.');
      }
      return;
    }

    hideError(fileError);
    showProgress();

    var reader = new FileReader();

    reader.onprogress = function (e) {
      if (e.lengthComputable) {
        var pct = Math.round((e.loaded / e.total) * 100);
        setProgress(pct);
      }
    };

    reader.onload = function (e) {
      setProgress(100);
      setTimeout(function () {
        hideProgress();
        currentImageData = e.target.result;
        showPreview(currentImageData);
        syncState();
      }, 300);
    };

    reader.onerror = function () {
      hideProgress();
      if (window.ErrorHandler) {
        window.ErrorHandler.showInline(fileError, 'UPLOAD_READ_ERROR');
        window.ErrorHandler.show('UPLOAD_READ_ERROR');
      } else {
        showError(fileError, 'Failed to read the file. Please try again.');
      }
    };

    reader.readAsDataURL(file);
  }

  function showPreview(dataUrl) {
    previewImg.src = dataUrl;
    preview.removeAttribute('hidden');
    dropzoneContent.setAttribute('hidden', '');
    dropzone.classList.add('mood-input__dropzone--has-preview');
  }

  function clearPreview() {
    currentImageData = null;
    previewImg.src = '';
    preview.setAttribute('hidden', '');
    dropzoneContent.removeAttribute('hidden');
    dropzone.classList.remove('mood-input__dropzone--has-preview');
    fileInput.value = '';
    cameraInput.value = '';
    hideError(fileError);
    syncState();
  }

  // Dropzone click → open file picker
  dropzone.addEventListener('click', function (e) {
    if (e.target.closest('#mood-remove-img')) return;
    if (currentImageData) return; // already has image, use remove button
    fileInput.click();
  });

  dropzone.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && !currentImageData) {
      e.preventDefault();
      fileInput.click();
    }
  });

  // File input change
  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files[0]) {
      processFile(fileInput.files[0]);
    }
  });

  // Camera input change
  cameraInput.addEventListener('change', function () {
    if (cameraInput.files && cameraInput.files[0]) {
      processFile(cameraInput.files[0]);
    }
  });

  // Camera button
  if (cameraBtn) {
    cameraBtn.addEventListener('click', function () {
      cameraInput.click();
    });
  }

  // Remove image
  removeBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    clearPreview();
  });

  // ── Drag and Drop ──

  dropzone.addEventListener('dragover', function (e) {
    e.preventDefault();
    dropzone.classList.add('mood-input__dropzone--dragover');
  });

  dropzone.addEventListener('dragleave', function (e) {
    e.preventDefault();
    dropzone.classList.remove('mood-input__dropzone--dragover');
  });

  dropzone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropzone.classList.remove('mood-input__dropzone--dragover');

    var files = e.dataTransfer && e.dataTransfer.files;
    if (files && files[0]) {
      processFile(files[0]);
    }
  });

  // ── Progress helpers ──

  function showProgress() {
    setProgress(0);
    progressWrap.removeAttribute('hidden');
    progressText.textContent = 'Reading file...';
  }

  function setProgress(pct) {
    progressBar.style.setProperty('--progress', pct + '%');
    progressBar.setAttribute('aria-valuenow', pct);
    if (pct < 100) {
      progressText.textContent = 'Uploading... ' + pct + '%';
    } else {
      progressText.textContent = 'Done!';
    }
  }

  function hideProgress() {
    progressWrap.setAttribute('hidden', '');
  }

  // ── Error helpers ──

  function showError(el, msg) {
    el.textContent = msg;
    el.removeAttribute('hidden');
  }

  function hideError(el) {
    el.textContent = '';
    el.setAttribute('hidden', '');
  }

  // ── State sync ──

  function syncState() {
    var wf = window.workflowState;
    if (!wf) return;

    var text = textarea.value.trim();
    var validText = text.length >= MIN_CHARS && text.length <= MAX_CHARS ? text : null;

    wf.setMoodInput(validText, currentImageData);
  }

  // ── Restore state on load ──

  function restoreState() {
    var wf = window.workflowState;
    if (!wf) return;

    var state = wf.getState();

    if (state.moodInput) {
      textarea.value = state.moodInput;
      updateCharCounter();
    }

    if (state.uploadedImage) {
      currentImageData = state.uploadedImage;
      showPreview(currentImageData);
    }
  }

  restoreState();
  updateCharCounter();
})();
