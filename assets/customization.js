/**
 * AI Custom Merchandise - Customization Workflow
 * Handles product selection and navigation to customization interface
 */

class CustomizationWorkflow {
  constructor() {
    this.sessionData = this.loadSessionData();
    this.init();
  }

  init() {
    this.bindEvents();
    this.restoreSession();
  }

  bindEvents() {
    // DISABLED: Old customization workflow
    // The new workflow uses direct product page navigation with design parameters
    // Product cards now have onclick handlers defined in collection.liquid
    
    // Only handle Start Customizing CTA button on homepage
    document.addEventListener('click', (e) => {
      // Start Customizing CTA button
      if (e.target.matches('.hero-cta .btn, .hero-cta .btn *')) {
        e.preventDefault();
        this.showProductSelection();
      }
    });

    // Handle browser back/forward navigation
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.step) {
        this.handleNavigationState(e.state);
      }
    });
  }

  /**
   * Select a product and navigate to customization
   * @param {string} productHandle - Shopify product handle
   * @param {string} productType - Product type (tshirt, mug, etc.)
   */
  selectProduct(productHandle, productType) {
    // Store selection in session
    this.sessionData.selectedProduct = {
      handle: productHandle,
      type: productType,
      timestamp: Date.now()
    };
    
    this.saveSessionData();

    // Show loading state
    this.showLoadingState('Preparing customization...');

    // Navigate to customization interface
    setTimeout(() => {
      this.navigateToCustomization(productHandle, productType);
    }, 500);
  }

  /**
   * Navigate to customization interface
   * @param {string} productHandle - Product handle
   * @param {string} productType - Product type
   */
  navigateToCustomization(productHandle, productType) {
    const customizationUrl = this.buildCustomizationUrl(productHandle, productType);
    
    // Update browser history
    const state = {
      step: 'customization',
      product: { handle: productHandle, type: productType }
    };
    
    history.pushState(state, 'Customize Product', customizationUrl);
    
    // Navigate to customization page
    window.location.href = customizationUrl;
  }

  /**
   * Build customization URL with product parameters
   * @param {string} productHandle - Product handle
   * @param {string} productType - Product type
   * @returns {string} Customization URL
   */
  buildCustomizationUrl(productHandle, productType) {
    const baseUrl = '/pages/customize';
    const params = new URLSearchParams({
      product: productHandle,
      type: productType,
      session: this.getSessionId()
    });
    
    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Show product selection (scroll to products section)
   */
  showProductSelection() {
    const productSection = document.querySelector('.product-grid-section');
    if (productSection) {
      productSection.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
      
      // Add highlight animation
      productSection.classList.add('highlight');
      setTimeout(() => {
        productSection.classList.remove('highlight');
      }, 2000);
    }
  }

  /**
   * Show loading state overlay
   * @param {string} message - Loading message
   */
  showLoadingState(message = 'Loading...') {
    // Remove existing loading overlay
    this.hideLoadingState();

    const overlay = document.createElement('div');
    overlay.className = 'customization-loading-overlay';
    overlay.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <p class="loading-message">${message}</p>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.classList.add('loading-active');
  }

  /**
   * Hide loading state overlay
   */
  hideLoadingState() {
    const overlay = document.querySelector('.customization-loading-overlay');
    if (overlay) {
      overlay.remove();
    }
    document.body.classList.remove('loading-active');
  }

  /**
   * Handle browser navigation state changes
   * @param {object} state - Navigation state
   */
  handleNavigationState(state) {
    switch (state.step) {
      case 'customization':
        if (state.product) {
          this.sessionData.selectedProduct = state.product;
          this.saveSessionData();
        }
        break;
      default:
        // Handle other navigation states
        break;
    }
  }

  /**
   * Load session data from localStorage
   * @returns {object} Session data
   */
  loadSessionData() {
    try {
      const data = localStorage.getItem('customization_session');
      return data ? JSON.parse(data) : this.getDefaultSessionData();
    } catch (error) {
      console.warn('Failed to load session data:', error);
      return this.getDefaultSessionData();
    }
  }

  /**
   * Save session data to localStorage
   */
  saveSessionData() {
    try {
      localStorage.setItem('customization_session', JSON.stringify(this.sessionData));
    } catch (error) {
      console.warn('Failed to save session data:', error);
    }
  }

  /**
   * Get default session data structure
   * @returns {object} Default session data
   */
  getDefaultSessionData() {
    return {
      sessionId: this.generateSessionId(),
      selectedProduct: null,
      currentStep: 1,
      createdAt: Date.now(),
      lastActivity: Date.now()
    };
  }

  /**
   * Generate unique session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get current session ID
   * @returns {string} Session ID
   */
  getSessionId() {
    return this.sessionData.sessionId;
  }

  /**
   * Restore session state on page load
   */
  restoreSession() {
    // Update last activity
    this.sessionData.lastActivity = Date.now();
    this.saveSessionData();

    // Check for expired sessions (24 hours)
    const sessionAge = Date.now() - this.sessionData.createdAt;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (sessionAge > maxAge) {
      this.clearSession();
    }
  }

  /**
   * Clear session data
   */
  clearSession() {
    localStorage.removeItem('customization_session');
    this.sessionData = this.getDefaultSessionData();
  }

  /**
   * Get selected product information
   * @returns {object|null} Selected product data
   */
  getSelectedProduct() {
    return this.sessionData.selectedProduct;
  }

  /**
   * Check if a product is currently selected
   * @returns {boolean} True if product is selected
   */
  hasSelectedProduct() {
    return this.sessionData.selectedProduct !== null;
  }
}

// Global functions for backward compatibility and direct calls
window.selectProduct = function(productHandle, productType) {
  if (window.customizationWorkflow) {
    window.customizationWorkflow.selectProduct(productHandle, productType);
  }
};

window.showProductSelection = function() {
  if (window.customizationWorkflow) {
    window.customizationWorkflow.showProductSelection();
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  window.customizationWorkflow = new CustomizationWorkflow();
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CustomizationWorkflow;
}