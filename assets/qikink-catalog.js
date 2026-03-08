/**
 * Qikink Product Catalog Integration
 * Manages product catalog data synced from Qikink's print-on-demand service.
 * Provides methods to browse, filter, and select products for the Step 3
 * product selection workflow.
 *
 * Requirements: 6.2, 6.3, 21.2, 21.3, 24.1, 24.2
 */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Shared reference data                                              */
  /* ------------------------------------------------------------------ */

  /**
   * Color definitions shared across apparel products.
   * Each color includes a display name and hex code for UI rendering.
   */
  var APPAREL_COLORS = [
    { name: 'Black', hex: '#000000' },
    { name: 'White', hex: '#FFFFFF' },
    { name: 'Navy Blue', hex: '#1B2A4A' },
    { name: 'Red', hex: '#C0392B' },
    { name: 'Royal Blue', hex: '#2E5BBA' },
    { name: 'Maroon', hex: '#6B1C23' },
    { name: 'Grey Melange', hex: '#9E9E9E' },
    { name: 'Olive Green', hex: '#556B2F' },
    { name: 'Pink', hex: '#E91E8A' },
    { name: 'Yellow', hex: '#F1C40F' },
    { name: 'Charcoal', hex: '#36454F' },
    { name: 'Sky Blue', hex: '#87CEEB' },
    { name: 'Bottle Green', hex: '#006A4E' },
    { name: 'Orange', hex: '#E67E22' },
    { name: 'Purple', hex: '#7D3C98' }
  ];

  /** Apparel sizes */
  var APPAREL_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

  /** Size chart data – chest width in inches */
  var SIZE_CHARTS = {
    'round-neck-tshirt': { S: '36', M: '38', L: '40', XL: '42', XXL: '44' },
    'polo-tshirt':       { S: '36', M: '38', L: '40', XL: '42', XXL: '44' },
    'cap':               { 'Free Size': 'Adjustable (56-60 cm)' }
  };

  /** Print area specs per category – dimensions in inches */
  var PRINT_AREAS = {
    'round-neck-tshirt': { width: 12, height: 16, position: 'front', dpi: 300, colorMode: 'CMYK' },
    'polo-tshirt':       { width: 10, height: 12, position: 'front', dpi: 300, colorMode: 'CMYK' },
    'mug':               { width: 8,  height: 3,  position: 'wrap',  dpi: 300, colorMode: 'CMYK' },
    'cap':               { width: 4,  height: 2.5, position: 'front', dpi: 300, colorMode: 'CMYK' },
    'sticker':           { width: 4,  height: 4,  position: 'full',  dpi: 300, colorMode: 'CMYK' }
  };

  /** AI design generation fee in INR – added on top of Qikink base price */
  var AI_DESIGN_FEE = 199;

  /** Default estimated delivery text */
  var ESTIMATED_DELIVERY = '2-5 business days';

  /* ------------------------------------------------------------------ */
  /*  Product catalog – mirrors Qikink's offerings                       */
  /* ------------------------------------------------------------------ */

  /**
   * Build variant array for a given set of colors and sizes.
   * Every color × size combination is generated with availability true.
   * @param {Array} colors - Array of {name, hex} objects
   * @param {Array} sizes  - Array of size strings
   * @returns {Array} variant objects
   */
  function buildVariants(colors, sizes) {
    var variants = [];
    for (var c = 0; c < colors.length; c++) {
      for (var s = 0; s < sizes.length; s++) {
        variants.push({
          size: sizes[s],
          color: colors[c].name,
          colorHex: colors[c].hex,
          available: true
        });
      }
    }
    return variants;
  }

  /**
   * Master product catalog.
   * Each entry represents a Qikink product type with all metadata needed
   * for the Step 3 product selection UI.
   */
  var PRODUCTS = [
    {
      sku: 'QK-RN',
      name: 'Round Neck T-Shirt',
      category: 'round-neck-tshirt',
      description: 'Premium 180 GSM cotton round neck t-shirt. Comfortable fit with bio-washed fabric for a soft feel.',
      material: '100% Cotton, 180 GSM, Bio-Washed',
      basePrice: 299,
      aiDesignFee: AI_DESIGN_FEE,
      printArea: PRINT_AREAS['round-neck-tshirt'],
      sizeChart: SIZE_CHARTS['round-neck-tshirt'],
      sizes: APPAREL_SIZES,
      colors: APPAREL_COLORS,
      variants: buildVariants(APPAREL_COLORS, APPAREL_SIZES),
      estimatedDelivery: ESTIMATED_DELIVERY,
      images: { front: 'round-neck-front.png', back: 'round-neck-back.png' }
    },
    {
      sku: 'QK-PL',
      name: 'Polo T-Shirt',
      category: 'polo-tshirt',
      description: 'Classic polo t-shirt with collar and button placket. 220 GSM pique cotton for a premium look.',
      material: '100% Cotton Pique, 220 GSM',
      basePrice: 449,
      aiDesignFee: AI_DESIGN_FEE,
      printArea: PRINT_AREAS['polo-tshirt'],
      sizeChart: SIZE_CHARTS['polo-tshirt'],
      sizes: APPAREL_SIZES,
      colors: APPAREL_COLORS,
      variants: buildVariants(APPAREL_COLORS, APPAREL_SIZES),
      estimatedDelivery: ESTIMATED_DELIVERY,
      images: { front: 'polo-front.png', back: 'polo-back.png' }
    },
    {
      sku: 'QK-MG',
      name: 'Ceramic Mug',
      category: 'mug',
      description: '11 oz white ceramic mug with glossy finish. Dishwasher and microwave safe.',
      material: 'White Ceramic, 11 oz',
      basePrice: 199,
      aiDesignFee: AI_DESIGN_FEE,
      printArea: PRINT_AREAS['mug'],
      sizeChart: null,
      sizes: [],
      colors: [{ name: 'White', hex: '#FFFFFF' }],
      variants: [{ size: 'Standard', color: 'White', colorHex: '#FFFFFF', available: true }],
      estimatedDelivery: ESTIMATED_DELIVERY,
      images: { front: 'mug-front.png', side: 'mug-side.png' }
    },
    {
      sku: 'QK-CP',
      name: 'Baseball Cap',
      category: 'cap',
      description: 'Adjustable cotton twill baseball cap with embroidery-ready front panel.',
      material: '100% Cotton Twill, Adjustable Strap',
      basePrice: 349,
      aiDesignFee: AI_DESIGN_FEE,
      printArea: PRINT_AREAS['cap'],
      sizeChart: SIZE_CHARTS['cap'],
      sizes: ['Free Size'],
      colors: [
        { name: 'Black', hex: '#000000' },
        { name: 'White', hex: '#FFFFFF' },
        { name: 'Navy Blue', hex: '#1B2A4A' },
        { name: 'Red', hex: '#C0392B' },
        { name: 'Grey Melange', hex: '#9E9E9E' },
        { name: 'Olive Green', hex: '#556B2F' },
        { name: 'Maroon', hex: '#6B1C23' },
        { name: 'Royal Blue', hex: '#2E5BBA' },
        { name: 'Charcoal', hex: '#36454F' },
        { name: 'Bottle Green', hex: '#006A4E' }
      ],
      variants: buildVariants([
        { name: 'Black', hex: '#000000' },
        { name: 'White', hex: '#FFFFFF' },
        { name: 'Navy Blue', hex: '#1B2A4A' },
        { name: 'Red', hex: '#C0392B' },
        { name: 'Grey Melange', hex: '#9E9E9E' },
        { name: 'Olive Green', hex: '#556B2F' },
        { name: 'Maroon', hex: '#6B1C23' },
        { name: 'Royal Blue', hex: '#2E5BBA' },
        { name: 'Charcoal', hex: '#36454F' },
        { name: 'Bottle Green', hex: '#006A4E' }
      ], ['Free Size']),
      estimatedDelivery: ESTIMATED_DELIVERY,
      images: { front: 'cap-front.png', side: 'cap-side.png' }
    },
    {
      sku: 'QK-ST',
      name: 'Vinyl Sticker',
      category: 'sticker',
      description: 'Premium vinyl die-cut sticker. Waterproof, UV resistant, and scratch-proof.',
      material: 'Premium Vinyl, Waterproof, UV Resistant',
      basePrice: 49,
      aiDesignFee: AI_DESIGN_FEE,
      printArea: PRINT_AREAS['sticker'],
      sizeChart: null,
      sizes: [],
      colors: [],
      variants: [{ size: '4x4 inch', color: 'Custom', colorHex: null, available: true }],
      estimatedDelivery: ESTIMATED_DELIVERY,
      images: { front: 'sticker-preview.png' }
    }
  ];

  /* ------------------------------------------------------------------ */
  /*  QikinkCatalog – public API                                         */
  /* ------------------------------------------------------------------ */

  var QikinkCatalog = {
    /** Current catalog version – bump when Qikink updates products */
    version: '1.0.0',

    /**
     * Get all products in the catalog.
     * @returns {Array} Full product list (shallow copies)
     */
    getProducts: function () {
      return PRODUCTS.slice();
    },

    /**
     * Get a single product by its base SKU (e.g. 'QK-RN').
     * @param {string} sku
     * @returns {Object|null}
     */
    getProductBySku: function (sku) {
      for (var i = 0; i < PRODUCTS.length; i++) {
        if (PRODUCTS[i].sku === sku) return PRODUCTS[i];
      }
      return null;
    },

    /**
     * Filter products by category.
     * @param {string} category - e.g. 'round-neck-tshirt', 'mug', 'cap', 'sticker'
     * @returns {Array}
     */
    getProductsByCategory: function (category) {
      return PRODUCTS.filter(function (p) {
        return p.category === category;
      });
    },

    /**
     * Get all available categories.
     * @returns {Array<string>}
     */
    getCategories: function () {
      var seen = {};
      var cats = [];
      for (var i = 0; i < PRODUCTS.length; i++) {
        if (!seen[PRODUCTS[i].category]) {
          seen[PRODUCTS[i].category] = true;
          cats.push(PRODUCTS[i].category);
        }
      }
      return cats;
    },

    /**
     * Get variants for a product identified by SKU.
     * @param {string} sku
     * @returns {Array}
     */
    getProductVariants: function (sku) {
      var product = this.getProductBySku(sku);
      return product ? product.variants.slice() : [];
    },

    /**
     * Get available colors for a category.
     * @param {string} category
     * @returns {Array<{name:string, hex:string}>}
     */
    getAvailableColors: function (category) {
      var products = this.getProductsByCategory(category);
      if (products.length === 0) return [];
      return products[0].colors.slice();
    },

    /**
     * Get available sizes for a category.
     * @param {string} category
     * @returns {Array<string>}
     */
    getAvailableSizes: function (category) {
      var products = this.getProductsByCategory(category);
      if (products.length === 0) return [];
      return products[0].sizes.slice();
    },

    /**
     * Calculate total price for a product including AI design fee.
     * @param {string} sku      - Product base SKU
     * @param {number} quantity - Number of items (default 1)
     * @returns {{basePrice:number, aiDesignFee:number, subtotal:number, total:number, currency:string}|null}
     */
    calculatePrice: function (sku, quantity) {
      var product = this.getProductBySku(sku);
      if (!product) return null;
      var qty = Math.max(1, parseInt(quantity, 10) || 1);
      var subtotal = product.basePrice * qty;
      var total = subtotal + product.aiDesignFee;
      return {
        basePrice: product.basePrice,
        aiDesignFee: product.aiDesignFee,
        subtotal: subtotal,
        total: total,
        quantity: qty,
        currency: 'INR'
      };
    },

    /**
     * Get size chart data for a category.
     * @param {string} category
     * @returns {Object|null} Map of size label → measurement
     */
    getSizeChart: function (category) {
      return SIZE_CHARTS[category] || null;
    },

    /**
     * Get print area specification for a category.
     * @param {string} category
     * @returns {Object|null}
     */
    getPrintArea: function (category) {
      return PRINT_AREAS[category] || null;
    },

    /**
     * Get estimated delivery text for a product.
     * @param {string} sku
     * @returns {string}
     */
    getEstimatedDelivery: function (sku) {
      var product = this.getProductBySku(sku);
      return product ? product.estimatedDelivery : ESTIMATED_DELIVERY;
    },

    /**
     * Build a full variant SKU string.
     * Example: QK-RN-BLK-M
     * @param {string} baseSku  - e.g. 'QK-RN'
     * @param {string} color    - Color name
     * @param {string} size     - Size label
     * @returns {string}
     */
    buildVariantSku: function (baseSku, color, size) {
      var colorCode = (color || 'CUSTOM')
        .toUpperCase()
        .replace(/\s+/g, '')
        .substring(0, 3);
      var sizeCode = (size || 'STD').toUpperCase().replace(/\s+/g, '');
      return baseSku + '-' + colorCode + '-' + sizeCode;
    },

    /**
     * Check whether a specific variant is available.
     * @param {string} sku   - Base SKU
     * @param {string} color - Color name
     * @param {string} size  - Size label
     * @returns {boolean}
     */
    isVariantAvailable: function (sku, color, size) {
      var variants = this.getProductVariants(sku);
      for (var i = 0; i < variants.length; i++) {
        var v = variants[i];
        if (v.color === color && v.size === size) return v.available;
      }
      return false;
    },

    /**
     * Mark a variant as unavailable (for out-of-stock handling).
     * Mutates the master catalog so the change is reflected everywhere.
     * @param {string} sku
     * @param {string} color
     * @param {string} size
     */
    setVariantUnavailable: function (sku, color, size) {
      var product = this.getProductBySku(sku);
      if (!product) return;
      for (var i = 0; i < product.variants.length; i++) {
        var v = product.variants[i];
        if (v.color === color && v.size === size) {
          v.available = false;
          return;
        }
      }
    },

    /**
     * Search products by name or description (case-insensitive).
     * @param {string} query
     * @returns {Array}
     */
    searchProducts: function (query) {
      if (!query || typeof query !== 'string') return [];
      var q = query.toLowerCase();
      return PRODUCTS.filter(function (p) {
        return p.name.toLowerCase().indexOf(q) !== -1 ||
               p.description.toLowerCase().indexOf(q) !== -1 ||
               p.category.toLowerCase().indexOf(q) !== -1;
      });
    },

    /**
     * Format a price in INR for display.
     * @param {number} amount
     * @returns {string} e.g. '₹299'
     */
    formatPrice: function (amount) {
      return '₹' + Number(amount).toLocaleString('en-IN');
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Expose globally                                                    */
  /* ------------------------------------------------------------------ */

  window.QikinkCatalog = QikinkCatalog;
})();
