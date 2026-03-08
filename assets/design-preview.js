/**
 * Design Preview Controller (Step 4)
 * Handles design-on-product mockup rendering, Qikink API integration for
 * design application, pinch-to-zoom on mobile, validation of print specs,
 * add-to-cart preparation, and navigation controls.
 *
 * Requirements: 7.2, 7.3, 7.4, 7.5, 7.7, 7.9, 7.10, 22.7,
 *               25.2, 25.3, 25.5, 25.6, 25.7, 25.10
 */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Configuration                                                      */
  /* ------------------------------------------------------------------ */

  var API_BASE_URL = window.DESIGN_API_URL || 'https://api-placeholder.example.com';
  var APPLY_TIMEOUT = 30000; // 30 seconds for Qikink API calls
  var MAX_RETRIES = 3;
  var RETRY_BASE_DELAY = 1000; // 1 second base for exponential backoff

  /* ------------------------------------------------------------------ */
  /*  DOM references                                                     */
  /* ------------------------------------------------------------------ */

  var els = {};

  function resolveElements() {
    els.root           = document.getElementById('design-preview');
    els.loading        = document.getElementById('dp-loading');
    els.error          = document.getElementById('dp-error');
    els.errorTitle     = document.getElementById('dp-error-title');
    els.errorMessage   = document.getElementById('dp-error-message');
    els.retryBtn       = document.getElementById('dp-retry-btn');
    els.content        = document.getElementById('dp-content');
    els.zoomContainer  = document.getElementById('dp-zoom-container');
    els.mockup         = document.getElementById('dp-mockup');
    els.productShape   = document.getElementById('dp-product-shape');
    els.designOverlay  = document.getElementById('dp-design-overlay');
    els.designImage    = document.getElementById('dp-design-image');
    els.zoomHint       = document.getElementById('dp-zoom-hint');
    els.productName    = document.getElementById('dp-product-name');
    els.colorSwatch    = document.getElementById('dp-color-swatch');
    els.variantText    = document.getElementById('dp-variant-text');
    els.material       = document.getElementById('dp-material');
    els.specArea       = document.getElementById('dp-spec-area');
    els.specPosition   = document.getElementById('dp-spec-position');
    els.specDpi        = document.getElementById('dp-spec-dpi');
    els.specColor      = document.getElementById('dp-spec-color');
    els.delivery       = document.getElementById('dp-delivery');
    els.basePrice      = document.getElementById('dp-base-price');
    els.designFee      = document.getElementById('dp-design-fee');
    els.totalPrice     = document.getElementById('dp-total-price');
    els.validation     = document.getElementById('dp-validation');
    els.validationText = document.getElementById('dp-validation-text');
    els.addToCartBtn   = document.getElementById('dp-add-to-cart');
    els.changeDesign   = document.getElementById('dp-change-design');
    els.changeProduct  = document.getElementById('dp-change-product');
  }

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  var currentDesign = null;
  var currentProduct = null;
  var retryCount = 0;
  var isApplying = false;

  // Pinch-to-zoom state
  var zoomState = {
    scale: 1,
    originX: 0,
    originY: 0,
    initialDistance: 0,
    initialScale: 1,
    isPinching: false,
    lastTap: 0
  };

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function formatPrice(amount) {
    if (window.QikinkCatalog) return window.QikinkCatalog.formatPrice(amount);
    return '\u20B9' + Number(amount).toLocaleString('en-IN');
  }

  /* ------------------------------------------------------------------ */
  /*  Category → mockup shape mapping                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Product shape CSS class and aspect ratio per category.
   * The mockup is a CSS-rendered representation, not a photo.
   */
  var SHAPE_MAP = {
    'round-neck-tshirt': { cls: 'tshirt', aspect: '3/4' },
    'polo-tshirt':       { cls: 'polo',   aspect: '3/4' },
    'mug':               { cls: 'mug',    aspect: '4/3' },
    'cap':               { cls: 'cap',    aspect: '4/3' },
    'sticker':           { cls: 'sticker', aspect: '1' }
  };

  /**
   * Print area overlay position as percentages of the mockup container.
   * These map Qikink's physical print areas to visual positions on the
   * CSS-rendered product shapes.
   */
  var OVERLAY_POSITIONS = {
    'round-neck-tshirt': { top: '22%', left: '25%', width: '50%', height: '45%' },
    'polo-tshirt':       { top: '25%', left: '27%', width: '46%', height: '40%' },
    'mug':               { top: '25%', left: '20%', width: '55%', height: '45%' },
    'cap':               { top: '25%', left: '28%', width: '44%', height: '30%' },
    'sticker':           { top: '12.5%', left: '12.5%', width: '75%', height: '75%' }
  };

  /* ------------------------------------------------------------------ */
  /*  Validation: check design meets Qikink requirements                 */
  /* ------------------------------------------------------------------ */

  /**
   * Validate that the design meets Qikink's technical requirements.
   * @param {Object} design  - { s3Url, thumbnailUrl, metadata }
   * @param {Object} product - { printArea: { width, height, dpi, colorMode } }
   * @returns {{ valid: boolean, issues: string[] }}
   */
  function validateDesignSpecs(design, product) {
    var issues = [];
    var pa = product.printArea;

    if (!design || !design.s3Url) {
      issues.push('Design file URL is missing.');
    }

    // Check DPI requirement (300 DPI minimum)
    if (pa && pa.dpi && design.metadata && design.metadata.dimensions) {
      if (design.metadata.dimensions.dpi < pa.dpi) {
        issues.push('Design resolution (' + design.metadata.dimensions.dpi + ' DPI) is below the required ' + pa.dpi + ' DPI.');
      }
    }

    // Check color mode
    if (pa && pa.colorMode && design.metadata && design.metadata.colorMode) {
      if (design.metadata.colorMode !== pa.colorMode) {
        issues.push('Design color mode should be ' + pa.colorMode + '.');
      }
    }

    return { valid: issues.length === 0, issues: issues };
  }

  /* ------------------------------------------------------------------ */
  /*  Qikink API integration: apply design to product                    */
  /* ------------------------------------------------------------------ */

  /**
   * Call the Qikink design application API.
   * Passes design S3 URL, product SKU, print area, position, and resolution.
   * Implements exponential backoff retry on failure.
   *
   * @param {Object} design  - Selected design object
   * @param {Object} product - Selected product object
   * @param {number} attempt - Current attempt number (0-based)
   * @returns {Promise<Object>} API response data
   */
  function applyDesignToProduct(design, product, attempt) {
    attempt = attempt || 0;

    var payload = {
      designId: design.id,
      designUrl: design.s3Url,
      productSku: product.sku,
      variantSku: product.variantSku,
      specifications: {
        printArea: {
          width: product.printArea.width,
          height: product.printArea.height,
          position: product.printArea.position
        },
        resolution: product.printArea.dpi,
        colorMode: product.printArea.colorMode
      }
    };

    return fetch(API_BASE_URL + '/apply-design', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(APPLY_TIMEOUT)
    })
      .then(function (response) {
        if (!response.ok) {
          return response.json().then(function (err) {
            var e = new Error(err.error || 'Design application failed');
            e.code = err.code || 'API_ERROR';
            throw e;
          });
        }
        return response.json();
      })
      .then(function (data) {
        if (data.success) return data;
        var e = new Error(data.error || 'Unexpected response');
        e.code = 'INVALID_RESPONSE';
        throw e;
      })
      .catch(function (error) {
        // Retry with exponential backoff for transient errors
        if (attempt < MAX_RETRIES - 1 && isRetryableError(error)) {
          var delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
          return new Promise(function (resolve) {
            setTimeout(resolve, delay);
          }).then(function () {
            return applyDesignToProduct(design, product, attempt + 1);
          });
        }
        throw error;
      });
  }

  /**
   * Determine if an error is retryable (network / timeout / 5xx).
   */
  function isRetryableError(error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') return true;
    if (error.message && error.message.toLowerCase().indexOf('network') !== -1) return true;
    if (error.code === 'SERVER_ERROR' || error.code === 'TIMEOUT') return true;
    return false;
  }

  /* ------------------------------------------------------------------ */
  /*  Render: populate the preview UI                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Render the full preview for the given design + product.
   */
  function renderPreview(design, product) {
    if (!els.content) return;

    currentDesign = design;
    currentProduct = product;

    // ── Product shape ──
    var shape = SHAPE_MAP[product.category] || SHAPE_MAP['round-neck-tshirt'];
    els.mockup.style.aspectRatio = shape.aspect;

    // Remove old shape classes, add new one
    var shapeEl = els.productShape;
    shapeEl.className = 'design-preview__product-shape design-preview__product-shape--' + shape.cls;

    // Set product color
    var colorHex = (product.variant && product.variant.colorHex) || '#333333';
    els.mockup.style.setProperty('--dp-product-color', colorHex);

    // ── Design overlay positioning ──
    var pos = OVERLAY_POSITIONS[product.category] || OVERLAY_POSITIONS['round-neck-tshirt'];
    var overlay = els.designOverlay;
    overlay.style.top = pos.top;
    overlay.style.left = pos.left;
    overlay.style.width = pos.width;
    overlay.style.height = pos.height;

    // Set design image with performance-optimized loading (Req 16.3)
    if (window.MobilePerformance) {
      window.MobilePerformance.loadDesignImage(
        els.designImage,
        design.thumbnailUrl || design.s3Url,
        'designPreview'
      );
    } else {
      els.designImage.src = design.thumbnailUrl || design.s3Url;
    }
    els.designImage.alt = 'Your custom design on ' + product.name;

    // ── Product info ──
    els.productName.textContent = product.name;
    var colorName = (product.variant && product.variant.color) || '';
    var sizeName = (product.variant && product.variant.size) || '';
    els.colorSwatch.style.backgroundColor = colorHex;
    els.variantText.textContent = [colorName, sizeName].filter(Boolean).join(' \u00B7 ');
    els.material.textContent = product.material || '';

    // ── Print specs ──
    var pa = product.printArea || {};
    els.specArea.textContent = (pa.width || '–') + '" × ' + (pa.height || '–') + '"';
    els.specPosition.textContent = capitalize(pa.position || 'front');
    els.specDpi.textContent = (pa.dpi || 300) + ' DPI';
    els.specColor.textContent = pa.colorMode || 'CMYK';

    // ── Delivery ──
    els.delivery.textContent = 'Estimated delivery: ' + (product.estimatedDelivery || '2-5 business days');

    // ── Pricing ──
    var pricing = product.pricing || {};
    els.basePrice.textContent = formatPrice(pricing.basePrice || 0);
    els.designFee.textContent = formatPrice(pricing.aiDesignFee || 0);
    els.totalPrice.textContent = formatPrice(pricing.total || 0);

    // ── Validation ──
    var validation = validateDesignSpecs(design, product);
    if (validation.valid) {
      els.validation.removeAttribute('hidden');
      els.validation.classList.remove('design-preview__validation--warning');
      els.validationText.textContent = 'Design meets all print requirements';
    } else {
      els.validation.removeAttribute('hidden');
      els.validation.classList.add('design-preview__validation--warning');
      els.validationText.textContent = validation.issues[0];
    }

    // Enable add-to-cart
    els.addToCartBtn.disabled = false;
  }

  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }

  /* ------------------------------------------------------------------ */
  /*  UI state transitions                                               */
  /* ------------------------------------------------------------------ */

  function showLoading() {
    if (els.loading) els.loading.removeAttribute('hidden');
    if (els.error) els.error.setAttribute('hidden', '');
    if (els.content) els.content.setAttribute('hidden', '');
  }

  function showError(title, message) {
    if (els.loading) els.loading.setAttribute('hidden', '');
    if (els.content) els.content.setAttribute('hidden', '');
    if (els.errorTitle) els.errorTitle.textContent = title;
    if (els.errorMessage) els.errorMessage.textContent = message;
    if (els.error) els.error.removeAttribute('hidden');
  }

  function showContent() {
    if (els.loading) els.loading.setAttribute('hidden', '');
    if (els.error) els.error.setAttribute('hidden', '');
    if (els.content) els.content.removeAttribute('hidden');
  }

  /* ------------------------------------------------------------------ */
  /*  Step activation: load data and render                              */
  /* ------------------------------------------------------------------ */

  /**
   * Called when Step 4 becomes active. Reads workflow state, validates
   * prerequisites, calls Qikink API, and renders the preview.
   */
  function activateStep() {
    var wf = window.workflowState;
    if (!wf) return;

    var state = wf.getState();
    var design = state.selectedDesign;
    var product = state.selectedProduct;

    if (!design || !design.s3Url) {
      showError('Missing Design', 'Please go back and select a design first.');
      return;
    }
    if (!product || !product.sku) {
      showError('Missing Product', 'Please go back and select a product first.');
      return;
    }

    retryCount = 0;
    applyAndRender(design, product);
  }

  /**
   * Apply design via API then render preview.
   */
  function applyAndRender(design, product) {
    if (isApplying) return;
    isApplying = true;
    showLoading();

    applyDesignToProduct(design, product)
      .then(function () {
        isApplying = false;
        renderPreview(design, product);
        showContent();
        resetZoom();
      })
      .catch(function (error) {
        isApplying = false;
        console.error('[DesignPreview] API error:', error);

        // Even if the API fails, still show the local preview so the
        // customer can see their design. Show a warning instead of blocking.
        renderPreview(design, product);
        showContent();
        resetZoom();

        // Update validation to show API warning
        if (els.validation) {
          els.validation.removeAttribute('hidden');
          els.validation.classList.add('design-preview__validation--warning');
          els.validationText.textContent = 'Design preview is approximate. We\u2019ll finalize during order processing.';
        }
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Pinch-to-zoom (mobile touch events)                                */
  /* ------------------------------------------------------------------ */

  /**
   * Get distance between two touch points.
   */
  function getTouchDistance(t1, t2) {
    var dx = t1.clientX - t2.clientX;
    var dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get midpoint between two touch points.
   */
  function getTouchMidpoint(t1, t2) {
    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2
    };
  }

  function handleTouchStart(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      zoomState.isPinching = true;
      zoomState.initialDistance = getTouchDistance(e.touches[0], e.touches[1]);
      zoomState.initialScale = zoomState.scale;
    }

    // Double-tap detection for zoom reset
    if (e.touches.length === 1) {
      var now = Date.now();
      if (now - zoomState.lastTap < 300) {
        e.preventDefault();
        resetZoom();
      }
      zoomState.lastTap = now;
    }
  }

  function handleTouchMove(e) {
    if (!zoomState.isPinching || e.touches.length < 2) return;
    e.preventDefault();

    var dist = getTouchDistance(e.touches[0], e.touches[1]);
    var scaleFactor = dist / zoomState.initialDistance;
    var newScale = Math.min(Math.max(zoomState.initialScale * scaleFactor, 1), 4);

    zoomState.scale = newScale;

    if (els.mockup) {
      els.mockup.style.transform = 'scale(' + newScale + ')';
    }
  }

  function handleTouchEnd(e) {
    if (e.touches.length < 2) {
      zoomState.isPinching = false;
    }
  }

  function resetZoom() {
    zoomState.scale = 1;
    zoomState.isPinching = false;
    if (els.mockup) {
      els.mockup.style.transform = 'scale(1)';
    }
  }

  function bindZoomEvents() {
    if (!els.zoomContainer) return;
    els.zoomContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
    els.zoomContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
    els.zoomContainer.addEventListener('touchend', handleTouchEnd, { passive: true });
  }

  /* ------------------------------------------------------------------ */
  /*  Navigation and cart actions                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Prepare cart data and dispatch to cart integration module.
   * The cart-integration.js module listens for design:addtocart and
   * calls Shopify's /cart/add.js with line item properties.
   * Requirements: 9.1, 9.2
   */
  function handleAddToCart() {
    if (!currentDesign || !currentProduct) return;

    var cartData = {
      designId: currentDesign.id,
      designUrl: currentDesign.s3Url,
      designThumbnail: currentDesign.thumbnailUrl || currentDesign.s3Url,
      productSku: currentProduct.sku,
      variantSku: currentProduct.variantSku,
      productName: currentProduct.name,
      category: currentProduct.category,
      variant: currentProduct.variant,
      printArea: currentProduct.printArea,
      pricing: currentProduct.pricing,
      estimatedDelivery: currentProduct.estimatedDelivery,
      sessionId: window.workflowState ? window.workflowState.getSessionId() : null
    };

    // Store cart-ready data in workflow state
    var wf = window.workflowState;
    if (wf) {
      wf.state.cartData = cartData;
      wf.markCompleted();
    }

    // Disable button while adding
    els.addToCartBtn.textContent = 'Adding...';
    els.addToCartBtn.disabled = true;

    // Emit event for cart integration module to handle
    document.dispatchEvent(new CustomEvent('design:addtocart', { detail: cartData }));
  }

  /**
   * Listen for cart events to update the Add to Cart button state.
   */
  function bindCartEvents() {
    document.addEventListener('cart:added', function () {
      if (!els.addToCartBtn) return;
      els.addToCartBtn.textContent = '✓ Added to Cart';
      setTimeout(function () {
        els.addToCartBtn.textContent = 'Add to Cart';
        els.addToCartBtn.disabled = false;
      }, 2500);
    });

    document.addEventListener('cart:error', function () {
      if (!els.addToCartBtn) return;
      els.addToCartBtn.textContent = 'Add to Cart';
      els.addToCartBtn.disabled = false;
    });
  }

  /**
   * Navigate back to Step 2 (design selection).
   */
  function handleChangeDesign() {
    var wf = window.workflowState;
    if (wf) wf.goToStep(2);
  }

  /**
   * Navigate back to Step 3 (product selection).
   */
  function handleChangeProduct() {
    var wf = window.workflowState;
    if (wf) wf.goToStep(3);
  }

  /**
   * Retry the design application after an error.
   */
  function handleRetry() {
    retryCount++;
    var wf = window.workflowState;
    if (!wf) return;

    var state = wf.getState();
    if (state.selectedDesign && state.selectedProduct) {
      applyAndRender(state.selectedDesign, state.selectedProduct);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Event binding                                                      */
  /* ------------------------------------------------------------------ */

  function bindEvents() {
    if (els.addToCartBtn) els.addToCartBtn.addEventListener('click', handleAddToCart);
    if (els.changeDesign) els.changeDesign.addEventListener('click', handleChangeDesign);
    if (els.changeProduct) els.changeProduct.addEventListener('click', handleChangeProduct);
    if (els.retryBtn) els.retryBtn.addEventListener('click', handleRetry);

    bindZoomEvents();
    bindCartEvents();

    // Listen for step activation
    document.addEventListener('workflow:stepchange', function (e) {
      if (e.detail.step === 4) {
        activateStep();
      }
    });

    // Listen for product re-selection (if user goes back and picks a new product)
    document.addEventListener('product:selected', function () {
      var wf = window.workflowState;
      if (wf && wf.getCurrentStep() === 4) {
        activateStep();
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Init                                                               */
  /* ------------------------------------------------------------------ */

  function init() {
    resolveElements();
    if (!els.root) return; // snippet not on this page

    bindEvents();

    // If we're already on step 4, activate immediately
    var wf = window.workflowState;
    if (wf && wf.getCurrentStep() === 4) {
      activateStep();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API for testing / debugging
  window.designPreview = {
    activateStep: activateStep,
    resetZoom: resetZoom,
    getCurrentDesign: function () { return currentDesign; },
    getCurrentProduct: function () { return currentProduct; },
    validateDesignSpecs: validateDesignSpecs
  };
})();
