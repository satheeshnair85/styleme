/**
 * Product Selection Controller (Step 3)
 * Handles product catalog display, category filtering, variant selection,
 * pricing calculation, size charts, and out-of-stock handling.
 *
 * Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 21.4, 21.5, 21.8, 13.6
 */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Category display labels                                            */
  /* ------------------------------------------------------------------ */

  var CATEGORY_LABELS = {
    'all':               'All Products',
    'round-neck-tshirt': 'T-Shirts',
    'polo-tshirt':       'Polos',
    'mug':               'Mugs',
    'cap':               'Caps',
    'sticker':           'Stickers'
  };

  var CATEGORY_ICONS = {
    'round-neck-tshirt': '👕',
    'polo-tshirt':       '👔',
    'mug':               '☕',
    'cap':               '🧢',
    'sticker':           '🏷️'
  };

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  var activeCategory = 'all';
  var openProductSku = null;   // SKU of product whose variant panel is open
  var selectedColor = null;
  var selectedSize = null;

  /* ------------------------------------------------------------------ */
  /*  DOM references (resolved lazily after init)                        */
  /* ------------------------------------------------------------------ */

  var els = {};

  function resolveElements() {
    els.filters      = document.querySelector('.product-selection__filters');
    els.grid         = document.getElementById('product-grid');
    els.empty        = document.getElementById('product-empty');
    els.variantPanel = document.getElementById('variant-panel');
    els.backdrop     = document.getElementById('variant-backdrop');
    els.closeBtn     = document.getElementById('variant-close');
    els.vpName       = document.getElementById('vp-name');
    els.vpMaterial   = document.getElementById('vp-material');
    els.vpColors     = document.getElementById('vp-colors');
    els.vpColorsSection = document.getElementById('vp-colors-section');
    els.vpSizes      = document.getElementById('vp-sizes');
    els.vpSizesSection  = document.getElementById('vp-sizes-section');
    els.vpSizeChartBtn  = document.getElementById('vp-size-chart-btn');
    els.vpDelivery   = document.getElementById('vp-delivery');
    els.vpBasePrice  = document.getElementById('vp-base-price');
    els.vpDesignFee  = document.getElementById('vp-design-fee');
    els.vpTotalPrice = document.getElementById('vp-total-price');
    els.vpStockNotice = document.getElementById('vp-stock-notice');
    els.vpSelectBtn  = document.getElementById('vp-select-btn');
    els.sizeModal    = document.getElementById('size-chart-modal');
    els.sizeModalBackdrop = document.getElementById('size-modal-backdrop');
    els.sizeModalClose    = document.getElementById('size-modal-close');
    els.sizeChartTable    = document.getElementById('size-chart-table');
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  var catalog = function () { return window.QikinkCatalog; };

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /* ------------------------------------------------------------------ */
  /*  Render: Category filter bar                                        */
  /* ------------------------------------------------------------------ */

  function renderFilters() {
    if (!els.filters) return;
    var cats = catalog().getCategories();
    var html = '<button class="product-selection__filter product-selection__filter--active" data-category="all" role="tab" aria-selected="true">All Products</button>';
    for (var i = 0; i < cats.length; i++) {
      var cat = cats[i];
      var label = CATEGORY_LABELS[cat] || cat;
      html += '<button class="product-selection__filter" data-category="' + esc(cat) + '" role="tab" aria-selected="false">' + esc(label) + '</button>';
    }
    els.filters.innerHTML = html;

    // Bind click events
    var btns = els.filters.querySelectorAll('.product-selection__filter');
    for (var j = 0; j < btns.length; j++) {
      btns[j].addEventListener('click', handleFilterClick);
    }
  }

  function handleFilterClick(e) {
    var cat = e.currentTarget.getAttribute('data-category');
    if (cat === activeCategory) return;
    activeCategory = cat;

    // Update active state
    var btns = els.filters.querySelectorAll('.product-selection__filter');
    for (var i = 0; i < btns.length; i++) {
      var isActive = btns[i].getAttribute('data-category') === cat;
      btns[i].classList.toggle('product-selection__filter--active', isActive);
      btns[i].setAttribute('aria-selected', isActive ? 'true' : 'false');
    }

    renderProductGrid();
  }

  /* ------------------------------------------------------------------ */
  /*  Render: Product grid                                               */
  /* ------------------------------------------------------------------ */

  function renderProductGrid() {
    if (!els.grid) return;
    var products = activeCategory === 'all'
      ? catalog().getProducts()
      : catalog().getProductsByCategory(activeCategory);

    if (products.length === 0) {
      els.grid.innerHTML = '';
      els.empty.removeAttribute('hidden');
      return;
    }
    els.empty.setAttribute('hidden', '');

    var html = '';
    for (var i = 0; i < products.length; i++) {
      html += buildProductCard(products[i]);
    }
    els.grid.innerHTML = html;

    // Bind card clicks
    var cards = els.grid.querySelectorAll('.product-card');
    for (var j = 0; j < cards.length; j++) {
      cards[j].addEventListener('click', handleCardClick);
      cards[j].addEventListener('keydown', handleCardKeydown);
    }
  }

  function buildProductCard(product) {
    var fmt = catalog().formatPrice;
    var total = product.basePrice + product.aiDesignFee;
    var icon = CATEGORY_ICONS[product.category] || '📦';

    return '' +
      '<div class="product-card" data-sku="' + esc(product.sku) + '" role="listitem" tabindex="0" aria-label="' + esc(product.name) + '">' +
        '<div class="product-card__image">' + icon + '</div>' +
        '<div class="product-card__body">' +
          '<h3 class="product-card__name">' + esc(product.name) + '</h3>' +
          '<p class="product-card__material">' + esc(product.material) + '</p>' +
          '<div class="product-card__pricing">' +
            '<span class="product-card__base-price">' + esc(fmt(product.basePrice)) + '</span>' +
            '<span class="product-card__plus">+</span>' +
            '<span class="product-card__design-fee">' + esc(fmt(product.aiDesignFee)) + ' AI Design</span>' +
            '<span class="product-card__plus">=</span>' +
            '<span class="product-card__total">' + esc(fmt(total)) + '</span>' +
          '</div>' +
          '<div class="product-card__delivery">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
              '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>' +
              '<circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>' +
            '</svg>' +
            '<span>' + esc(product.estimatedDelivery) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function handleCardClick(e) {
    var sku = e.currentTarget.getAttribute('data-sku');
    openVariantPanel(sku);
  }

  function handleCardKeydown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      var sku = e.currentTarget.getAttribute('data-sku');
      openVariantPanel(sku);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Variant Panel                                                      */
  /* ------------------------------------------------------------------ */

  function openVariantPanel(sku) {
    var product = catalog().getProductBySku(sku);
    if (!product) return;

    openProductSku = sku;
    selectedColor = null;
    selectedSize = null;

    // Populate header
    els.vpName.textContent = product.name;
    els.vpMaterial.textContent = product.material;

    // Render colors
    renderColorSwatches(product);

    // Render sizes
    renderSizeButtons(product);

    // Delivery
    els.vpDelivery.textContent = 'Estimated delivery: ' + product.estimatedDelivery;

    // Pricing
    updatePricing(product);

    // Reset state
    els.vpStockNotice.setAttribute('hidden', '');
    els.vpSelectBtn.disabled = true;

    // Size chart button visibility
    if (product.sizeChart) {
      els.vpSizeChartBtn.style.display = '';
    } else {
      els.vpSizeChartBtn.style.display = 'none';
    }

    // Show/hide sections for products without colors or sizes
    els.vpColorsSection.style.display = product.colors.length > 0 ? '' : 'none';
    els.vpSizesSection.style.display = product.sizes.length > 0 ? '' : 'none';

    // For products with no color/size options, auto-select the only variant
    if (product.colors.length === 0 && product.sizes.length === 0 && product.variants.length === 1) {
      selectedColor = product.variants[0].color;
      selectedSize = product.variants[0].size;
      updateSelectButton(product);
    }

    // Show panel
    els.variantPanel.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';

    // Focus trap
    els.closeBtn.focus();
  }

  function closeVariantPanel() {
    els.variantPanel.setAttribute('hidden', '');
    document.body.style.overflow = '';
    openProductSku = null;
    selectedColor = null;
    selectedSize = null;
  }

  /* ------------------------------------------------------------------ */
  /*  Color Swatches                                                     */
  /* ------------------------------------------------------------------ */

  function renderColorSwatches(product) {
    if (!els.vpColors) return;
    if (product.colors.length === 0) {
      els.vpColors.innerHTML = '';
      return;
    }

    var html = '';
    for (var i = 0; i < product.colors.length; i++) {
      var c = product.colors[i];
      var borderStyle = c.hex === '#FFFFFF' ? 'box-shadow:inset 0 0 0 1px rgba(0,0,0,0.2);' : '';
      html += '<button class="color-swatch" data-color="' + esc(c.name) + '" ' +
        'style="background-color:' + esc(c.hex) + ';' + borderStyle + '" ' +
        'role="radio" aria-checked="false" aria-label="' + esc(c.name) + '" title="' + esc(c.name) + '">' +
        '<span class="color-swatch__tooltip">' + esc(c.name) + '</span>' +
        '</button>';
    }
    els.vpColors.innerHTML = html;

    // Bind
    var swatches = els.vpColors.querySelectorAll('.color-swatch');
    for (var j = 0; j < swatches.length; j++) {
      swatches[j].addEventListener('click', handleColorClick);
    }
  }

  function handleColorClick(e) {
    var colorName = e.currentTarget.getAttribute('data-color');
    if (e.currentTarget.getAttribute('aria-disabled') === 'true') return;

    selectedColor = colorName;

    // Update UI
    var swatches = els.vpColors.querySelectorAll('.color-swatch');
    for (var i = 0; i < swatches.length; i++) {
      var isSelected = swatches[i].getAttribute('data-color') === colorName;
      swatches[i].classList.toggle('color-swatch--selected', isSelected);
      swatches[i].setAttribute('aria-checked', isSelected ? 'true' : 'false');
    }

    // Update size availability based on selected color
    var product = catalog().getProductBySku(openProductSku);
    if (product) {
      updateSizeAvailability(product);
      updateSelectButton(product);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Size Buttons                                                       */
  /* ------------------------------------------------------------------ */

  function renderSizeButtons(product) {
    if (!els.vpSizes) return;
    if (product.sizes.length === 0) {
      els.vpSizes.innerHTML = '';
      return;
    }

    var html = '';
    for (var i = 0; i < product.sizes.length; i++) {
      var s = product.sizes[i];
      html += '<button class="size-btn" data-size="' + esc(s) + '" ' +
        'role="radio" aria-checked="false" aria-label="Size ' + esc(s) + '">' +
        esc(s) + '</button>';
    }
    els.vpSizes.innerHTML = html;

    // Bind
    var btns = els.vpSizes.querySelectorAll('.size-btn');
    for (var j = 0; j < btns.length; j++) {
      btns[j].addEventListener('click', handleSizeClick);
    }
  }

  function handleSizeClick(e) {
    var size = e.currentTarget.getAttribute('data-size');
    if (e.currentTarget.getAttribute('aria-disabled') === 'true') return;

    selectedSize = size;

    // Update UI
    var btns = els.vpSizes.querySelectorAll('.size-btn');
    for (var i = 0; i < btns.length; i++) {
      var isSelected = btns[i].getAttribute('data-size') === size;
      btns[i].classList.toggle('size-btn--selected', isSelected);
      btns[i].setAttribute('aria-checked', isSelected ? 'true' : 'false');
    }

    var product = catalog().getProductBySku(openProductSku);
    if (product) {
      updateSelectButton(product);
    }
  }

  /**
   * Grey out sizes that are unavailable for the currently selected color.
   */
  function updateSizeAvailability(product) {
    if (!selectedColor || product.sizes.length === 0) return;

    var btns = els.vpSizes.querySelectorAll('.size-btn');
    for (var i = 0; i < btns.length; i++) {
      var size = btns[i].getAttribute('data-size');
      var available = catalog().isVariantAvailable(product.sku, selectedColor, size);
      btns[i].setAttribute('aria-disabled', available ? 'false' : 'true');
      if (!available && selectedSize === size) {
        selectedSize = null;
        btns[i].classList.remove('size-btn--selected');
        btns[i].setAttribute('aria-checked', 'false');
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Pricing                                                            */
  /* ------------------------------------------------------------------ */

  function updatePricing(product) {
    var fmt = catalog().formatPrice;
    els.vpBasePrice.textContent = fmt(product.basePrice);
    els.vpDesignFee.textContent = fmt(product.aiDesignFee);
    els.vpTotalPrice.textContent = fmt(product.basePrice + product.aiDesignFee);
  }

  /* ------------------------------------------------------------------ */
  /*  Select button state                                                */
  /* ------------------------------------------------------------------ */

  function updateSelectButton(product) {
    var needsColor = product.colors.length > 0;
    var needsSize = product.sizes.length > 0;

    var colorOk = !needsColor || selectedColor !== null;
    var sizeOk = !needsSize || selectedSize !== null;

    // Check stock
    var inStock = true;
    if (colorOk && sizeOk) {
      var checkColor = selectedColor || (product.variants[0] && product.variants[0].color);
      var checkSize = selectedSize || (product.variants[0] && product.variants[0].size);
      inStock = catalog().isVariantAvailable(product.sku, checkColor, checkSize);
    }

    if (!inStock) {
      els.vpStockNotice.removeAttribute('hidden');
      els.vpSelectBtn.disabled = true;
    } else {
      els.vpStockNotice.setAttribute('hidden', '');
      els.vpSelectBtn.disabled = !(colorOk && sizeOk);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Size Chart Modal                                                   */
  /* ------------------------------------------------------------------ */

  function openSizeChart() {
    var product = catalog().getProductBySku(openProductSku);
    if (!product || !product.sizeChart) return;

    var chart = product.sizeChart;
    var sizes = Object.keys(chart);

    var html = '<table class="size-chart-table"><thead><tr><th>Size</th><th>Chest (inches)</th></tr></thead><tbody>';
    for (var i = 0; i < sizes.length; i++) {
      html += '<tr><td>' + esc(sizes[i]) + '</td><td>' + esc(chart[sizes[i]]) + '</td></tr>';
    }
    html += '</tbody></table>';
    els.sizeChartTable.innerHTML = html;

    els.sizeModal.removeAttribute('hidden');
    els.sizeModalClose.focus();
  }

  function closeSizeChart() {
    els.sizeModal.setAttribute('hidden', '');
    if (els.vpSizeChartBtn) els.vpSizeChartBtn.focus();
  }

  /* ------------------------------------------------------------------ */
  /*  Confirm selection → save to workflow state and advance             */
  /* ------------------------------------------------------------------ */

  function confirmSelection() {
    var product = catalog().getProductBySku(openProductSku);
    if (!product) return;

    var color = selectedColor || (product.variants[0] && product.variants[0].color) || null;
    var size = selectedSize || (product.variants[0] && product.variants[0].size) || null;
    var variantSku = catalog().buildVariantSku(product.sku, color, size);
    var pricing = catalog().calculatePrice(product.sku, 1);

    var selection = {
      sku: product.sku,
      variantSku: variantSku,
      name: product.name,
      category: product.category,
      material: product.material,
      variant: {
        color: color,
        colorHex: getColorHex(product, color),
        size: size
      },
      printArea: product.printArea,
      pricing: pricing,
      estimatedDelivery: product.estimatedDelivery
    };

    // Save to workflow state
    var wf = window.workflowState;
    if (wf) {
      wf.setSelectedProduct(selection);
    }

    // Emit event
    document.dispatchEvent(new CustomEvent('product:selected', { detail: selection }));

    // Close panel
    closeVariantPanel();

    // Advance to Step 4
    if (wf) {
      wf.goToStep(4);
    }
  }

  function getColorHex(product, colorName) {
    if (!colorName) return null;
    for (var i = 0; i < product.colors.length; i++) {
      if (product.colors[i].name === colorName) return product.colors[i].hex;
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /*  Event binding                                                      */
  /* ------------------------------------------------------------------ */

  function bindGlobalEvents() {
    // Close variant panel
    if (els.backdrop) els.backdrop.addEventListener('click', closeVariantPanel);
    if (els.closeBtn) els.closeBtn.addEventListener('click', closeVariantPanel);

    // Size chart
    if (els.vpSizeChartBtn) els.vpSizeChartBtn.addEventListener('click', openSizeChart);
    if (els.sizeModalBackdrop) els.sizeModalBackdrop.addEventListener('click', closeSizeChart);
    if (els.sizeModalClose) els.sizeModalClose.addEventListener('click', closeSizeChart);

    // Select button
    if (els.vpSelectBtn) els.vpSelectBtn.addEventListener('click', confirmSelection);

    // Escape key closes modals
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (els.sizeModal && !els.sizeModal.hasAttribute('hidden')) {
          closeSizeChart();
        } else if (els.variantPanel && !els.variantPanel.hasAttribute('hidden')) {
          closeVariantPanel();
        }
      }
    });

    // Listen for step activation
    document.addEventListener('workflow:stepchange', function (e) {
      if (e.detail.step === 3) {
        renderProductGrid();
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Init                                                               */
  /* ------------------------------------------------------------------ */

  function init() {
    if (!window.QikinkCatalog) {
      console.warn('[ProductSelection] QikinkCatalog not loaded.');
      return;
    }

    resolveElements();
    renderFilters();
    renderProductGrid();
    bindGlobalEvents();
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API for testing / debugging
  window.productSelection = {
    openVariantPanel: openVariantPanel,
    closeVariantPanel: closeVariantPanel,
    getActiveCategory: function () { return activeCategory; },
    getSelection: function () {
      return { sku: openProductSku, color: selectedColor, size: selectedSize };
    }
  };
})();
