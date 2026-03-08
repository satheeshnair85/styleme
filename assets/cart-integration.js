/**
 * Cart Integration Module
 * Handles adding customized products to Shopify cart with design metadata
 * stored as line item properties. Listens for the design:addtocart event
 * from the design preview step and calls Shopify's Cart API.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.5
 */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Configuration                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * Shopify variant ID for the custom-design product.
   * This should be a generic "Custom Design Product" in Shopify that acts
   * as the base product for all AI-customized items. The actual product
   * details (type, color, size) are stored in line item properties.
   *
   * Falls back to a configurable window variable so the theme can set it.
   */
  function getVariantId() {
    return window.CUSTOM_PRODUCT_VARIANT_ID || null;
  }

  /* ------------------------------------------------------------------ */
  /*  Shopify Cart API helpers                                           */
  /* ------------------------------------------------------------------ */

  /**
   * Add an item to the Shopify cart via /cart/add.js
   * @param {Object} payload - { id, quantity, properties }
   * @returns {Promise<Object>} Shopify cart item response
   */
  function cartAdd(payload) {
    return fetch(window.routes ? window.routes.cart_add_url : '/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ items: [payload] })
    }).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (err) {
          var e = new Error(err.description || err.message || 'Failed to add to cart');
          e.status = res.status;
          throw e;
        });
      }
      return res.json();
    });
  }

  /**
   * Get the current cart contents via /cart.js
   * @returns {Promise<Object>} Shopify cart object
   */
  function cartGet() {
    return fetch(window.routes ? window.routes.cart_url + '.js' : '/cart.js', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }).then(function (res) {
      if (!res.ok) throw new Error('Failed to fetch cart');
      return res.json();
    });
  }

  /**
   * Update a cart line item quantity via /cart/change.js
   * Preserves all line item properties (design metadata) through the change.
   * @param {string} lineKey - The line item key
   * @param {number} quantity - New quantity
   * @returns {Promise<Object>} Updated cart object
   */
  function cartChange(lineKey, quantity) {
    return fetch(window.routes ? window.routes.cart_change_url : '/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: lineKey, quantity: quantity })
    }).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (err) {
          var e = new Error(err.description || err.message || 'Failed to update cart');
          e.status = res.status;
          throw e;
        });
      }
      return res.json();
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Build line item properties from design + product data              */
  /* ------------------------------------------------------------------ */

  /**
   * Build Shopify line item properties object from cart data.
   * These properties travel with the cart item through checkout and
   * appear in the order for fulfillment reference.
   *
   * @param {Object} cartData - Data from design:addtocart event
   * @returns {Object} Line item properties
   */
  function buildLineItemProperties(cartData) {
    var props = {
      '_design_id': cartData.designId || '',
      '_design_url': cartData.designUrl || '',
      '_design_thumbnail': cartData.designThumbnail || cartData.designUrl || '',
      '_product_sku': cartData.productSku || '',
      '_variant_sku': cartData.variantSku || '',
      '_product_category': cartData.category || '',
      '_print_area_width': String((cartData.printArea && cartData.printArea.width) || ''),
      '_print_area_height': String((cartData.printArea && cartData.printArea.height) || ''),
      '_print_position': (cartData.printArea && cartData.printArea.position) || 'front',
      '_print_dpi': String((cartData.printArea && cartData.printArea.dpi) || '300'),
      '_print_color_mode': (cartData.printArea && cartData.printArea.colorMode) || 'CMYK',
      '_session_id': cartData.sessionId || ''
    };

    // Add variant details
    if (cartData.variant) {
      if (cartData.variant.color) props['_color'] = cartData.variant.color;
      if (cartData.variant.colorHex) props['_color_hex'] = cartData.variant.colorHex;
      if (cartData.variant.size) props['_size'] = cartData.variant.size;
    }

    // Visible properties (no underscore prefix) show in cart/checkout UI
    props['Design'] = 'AI Custom Design';
    if (cartData.variant && cartData.variant.color) {
      props['Color'] = cartData.variant.color;
    }
    if (cartData.variant && cartData.variant.size) {
      props['Size'] = cartData.variant.size;
    }
    props['Product Type'] = formatCategoryName(cartData.category);

    // Visible design preview URL for order confirmation emails (Req 10.4)
    if (cartData.designThumbnail || cartData.designUrl) {
      props['Design Preview'] = cartData.designThumbnail || cartData.designUrl;
    }

    return props;
  }

  /**
   * Format category slug to display name.
   */
  function formatCategoryName(category) {
    var names = {
      'round-neck-tshirt': 'Round Neck T-Shirt',
      'polo-tshirt': 'Polo T-Shirt',
      'mug': 'Ceramic Mug',
      'cap': 'Baseball Cap',
      'sticker': 'Vinyl Sticker'
    };
    return names[category] || category || 'Custom Product';
  }

  /* ------------------------------------------------------------------ */
  /*  Add to cart handler                                                */
  /* ------------------------------------------------------------------ */

  /**
   * Handle the design:addtocart event. Adds the customized product
   * to the Shopify cart with all design metadata as line item properties.
   *
   * @param {CustomEvent} event - Contains cartData in event.detail
   */
  function handleAddToCart(event) {
    var cartData = event.detail;
    if (!cartData || !cartData.designUrl) {
      console.error('[CartIntegration] Missing design data');
      emitCartEvent('cart:error', { message: 'Missing design data' });
      return;
    }

    var variantId = getVariantId();
    if (!variantId) {
      console.error('[CartIntegration] No variant ID configured. Set window.CUSTOM_PRODUCT_VARIANT_ID.');
      emitCartEvent('cart:error', { message: 'Product not configured' });
      return;
    }

    var properties = buildLineItemProperties(cartData);

    var payload = {
      id: variantId,
      quantity: 1,
      properties: properties
    };

    emitCartEvent('cart:adding', { cartData: cartData });

    cartAdd(payload)
      .then(function (response) {
        console.log('[CartIntegration] Added to cart:', response);
        emitCartEvent('cart:added', { response: response, cartData: cartData });
        updateCartCount();
        showCartFeedback(true);
      })
      .catch(function (error) {
        console.error('[CartIntegration] Add to cart failed:', error);
        emitCartEvent('cart:error', { message: error.message, cartData: cartData });
        showCartFeedback(false, error.message);
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Cart count badge update                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Fetch the current cart and update the header cart count badge.
   */
  function updateCartCount() {
    cartGet().then(function (cart) {
      var badge = document.getElementById('cart-count');
      if (badge) {
        badge.textContent = cart.item_count;
        badge.style.display = cart.item_count > 0 ? '' : 'none';
      }
      // Also update any other cart count elements
      var badges = document.querySelectorAll('[data-cart-count]');
      for (var i = 0; i < badges.length; i++) {
        badges[i].textContent = cart.item_count;
      }
    }).catch(function () {
      // Silently fail – badge update is non-critical
    });
  }

  /* ------------------------------------------------------------------ */
  /*  User feedback                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * Show a toast notification after add-to-cart attempt.
   */
  function showCartFeedback(success, errorMsg) {
    // Remove existing toast
    var existing = document.getElementById('cart-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'cart-toast';
    toast.className = 'cart-toast ' + (success ? 'cart-toast--success' : 'cart-toast--error');
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    if (success) {
      toast.innerHTML =
        '<span class="cart-toast__icon">✓</span>' +
        '<span class="cart-toast__text">Added to cart!</span>' +
        '<a href="/cart" class="cart-toast__link">View Cart</a>';
    } else {
      toast.innerHTML =
        '<span class="cart-toast__icon">✕</span>' +
        '<span class="cart-toast__text">' + escapeHtml(errorMsg || 'Failed to add to cart') + '</span>';
    }

    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(function () {
      toast.classList.add('cart-toast--visible');
    });

    // Auto-dismiss after 4 seconds
    setTimeout(function () {
      toast.classList.remove('cart-toast--visible');
      setTimeout(function () { toast.remove(); }, 300);
    }, 4000);
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function emitCartEvent(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail: detail }));
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /* ------------------------------------------------------------------ */
  /*  Cart page: quantity change with design preservation                */
  /* ------------------------------------------------------------------ */

  /**
   * Handle quantity changes on the cart page.
   * Uses Shopify's /cart/change.js which preserves line item properties.
   *
   * @param {string} lineKey - Line item key
   * @param {number} newQty - New quantity (0 to remove)
   */
  function handleQuantityChange(lineKey, newQty) {
    cartChange(lineKey, Math.max(0, parseInt(newQty, 10) || 0))
      .then(function () {
        // Reload cart page to reflect changes
        window.location.reload();
      })
      .catch(function (error) {
        console.error('[CartIntegration] Quantity change failed:', error);
        showCartFeedback(false, 'Failed to update quantity');
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Event binding                                                      */
  /* ------------------------------------------------------------------ */

  function init() {
    // Listen for add-to-cart events from design preview
    document.addEventListener('design:addtocart', handleAddToCart);

    // Bind quantity change handlers on cart page
    bindCartPageEvents();
  }

  /**
   * Bind event handlers for the cart page quantity controls.
   */
  function bindCartPageEvents() {
    // Quantity +/- buttons
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cart-qty-btn]');
      if (!btn) return;

      var lineKey = btn.getAttribute('data-line-key');
      var delta = parseInt(btn.getAttribute('data-cart-qty-btn'), 10);
      var input = document.querySelector('input[data-line-key="' + lineKey + '"]');
      if (!input) return;

      var currentQty = parseInt(input.value, 10) || 1;
      var newQty = Math.max(0, currentQty + delta);
      handleQuantityChange(lineKey, newQty);
    });

    // Quantity input direct change
    document.addEventListener('change', function (e) {
      if (!e.target.matches('[data-cart-qty-input]')) return;
      var lineKey = e.target.getAttribute('data-line-key');
      var newQty = parseInt(e.target.value, 10) || 0;
      handleQuantityChange(lineKey, newQty);
    });

    // Remove item buttons
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cart-remove]');
      if (!btn) return;
      var lineKey = btn.getAttribute('data-line-key');
      handleQuantityChange(lineKey, 0);
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Boot                                                               */
  /* ------------------------------------------------------------------ */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  window.cartIntegration = {
    addToCart: handleAddToCart,
    getCart: cartGet,
    updateQuantity: handleQuantityChange,
    updateCartCount: updateCartCount,
    buildLineItemProperties: buildLineItemProperties
  };
})();
