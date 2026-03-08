/**
 * AI Custom Merchandise Theme JavaScript
 * Mobile-First Progressive Web App
 */

(function() {
  'use strict';

  // Mobile Menu Toggle
  function initMobileMenu() {
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const mobileNav = document.querySelector('.mobile-nav');
    
    if (menuToggle && mobileNav) {
      menuToggle.addEventListener('click', function() {
        const isExpanded = this.getAttribute('aria-expanded') === 'true';
        this.setAttribute('aria-expanded', !isExpanded);
        mobileNav.classList.toggle('active');
      });
    }
  }

  // Enhanced Cart Management with Offline Support
  async function updateCartCount() {
    try {
      const response = await fetch('/cart.js');
      const cart = await response.json();
      
      const cartCountElements = document.querySelectorAll('[data-cart-count]');
      cartCountElements.forEach(element => {
        element.textContent = cart.item_count;
      });
      
      // Cache cart data for offline access
      if (window.offlineStorage) {
        await window.offlineStorage.savePreference('cart_count', cart.item_count);
        await window.offlineStorage.savePreference('cart_data', cart);
      }
    } catch (error) {
      console.error('Error updating cart count:', error);
      
      // Try to get cached cart count if offline
      if (window.offlineStorage) {
        const cachedCount = await window.offlineStorage.getPreference('cart_count');
        if (cachedCount !== null) {
          const cartCountElements = document.querySelectorAll('[data-cart-count]');
          cartCountElements.forEach(element => {
            element.textContent = cachedCount;
          });
        }
      }
    }
  }

  // Queue cart operations when offline
  async function queueCartOperation(url, method, data) {
    if (!navigator.onLine && window.offlineStorage) {
      const operation = {
        url: url,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(data),
        timestamp: Date.now()
      };
      
      await window.offlineStorage.queueCartOperation(operation);
      
      // Register for background sync
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-cart');
      }
      
      return { queued: true };
    }
    
    // If online, make the request normally
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(data)
    });
    
    return await response.json();
  }

  // Queue design requests when offline
  async function queueDesignRequest(prompt, productType) {
    if (!navigator.onLine && window.offlineStorage) {
      const request = {
        prompt: prompt,
        productType: productType,
        sessionId: generateSessionId(),
        timestamp: Date.now()
      };
      
      const requestId = await window.offlineStorage.queueDesignRequest(request);
      
      // Register for background sync
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-design-requests');
      }
      
      // Show queued message to user
      showQueuedDesignMessage();
      
      return { queued: true, requestId: requestId };
    }
    
    // If online, make the request normally
    const response = await fetch('/api/generate-design', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        productType: productType,
        sessionId: generateSessionId()
      })
    });
    
    return await response.json();
  }

  // Generate session ID
  function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Show queued design message
  function showQueuedDesignMessage() {
    const message = document.createElement('div');
    message.className = 'queued-message';
    message.innerHTML = `
      <div class="queued-content">
        <span>🔄 Design request queued. We'll generate it when you're back online!</span>
        <button onclick="this.closest('.queued-message').remove()" class="btn-dismiss">×</button>
      </div>
    `;
    
    message.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      right: 20px;
      background: #f59e0b;
      color: white;
      padding: 1rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 9999;
      font-size: 0.875rem;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      .queued-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }
      .queued-message .btn-dismiss {
        background: none;
        border: none;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(message);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      if (message.parentNode) {
        message.remove();
      }
    }, 5000);
  }

  // Enhanced PWA Install Prompt
  let deferredPrompt;
  let installPromptShown = false;
  
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Show install prompt after user has interacted with the site
    if (!installPromptShown) {
      setTimeout(showInstallPromotion, 3000);
    }
  });

  function showInstallPromotion() {
    if (!deferredPrompt || installPromptShown) return;
    
    installPromptShown = true;
    
    // Create install banner
    const installBanner = document.createElement('div');
    installBanner.className = 'pwa-install-banner';
    installBanner.innerHTML = `
      <div class="install-banner-content">
        <div class="install-banner-text">
          <strong>Install AI Custom Merchandise</strong>
          <p>Get the full app experience with offline access</p>
        </div>
        <div class="install-banner-actions">
          <button class="btn-install" onclick="themeUtils.installPWA()">Install</button>
          <button class="btn-dismiss" onclick="this.closest('.pwa-install-banner').remove()">×</button>
        </div>
      </div>
    `;
    
    // Add styles
    installBanner.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      right: 20px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      z-index: 9999;
      padding: 1rem;
      border: 1px solid #e5e7eb;
      animation: slideUp 0.3s ease-out;
    `;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideUp {
        from { transform: translateY(100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .install-banner-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }
      .install-banner-text strong {
        display: block;
        color: #1f2937;
        font-size: 1rem;
        margin-bottom: 0.25rem;
      }
      .install-banner-text p {
        color: #6b7280;
        font-size: 0.875rem;
        margin: 0;
      }
      .install-banner-actions {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }
      .btn-install {
        background: #6366f1;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.875rem;
      }
      .btn-install:hover {
        background: #5856eb;
      }
      .btn-dismiss {
        background: none;
        border: none;
        color: #6b7280;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0.25rem;
        line-height: 1;
      }
      @media (max-width: 480px) {
        .install-banner-content {
          flex-direction: column;
          text-align: center;
        }
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(installBanner);
    
    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (installBanner.parentNode) {
        installBanner.remove();
      }
    }, 10000);
  }

  // Enhanced PWA Install Function
  function installPWA() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
          // Track install event
          if (typeof gtag !== 'undefined') {
            gtag('event', 'pwa_install', {
              event_category: 'engagement',
              event_label: 'accepted'
            });
          }
        } else {
          console.log('User dismissed the install prompt');
        }
        deferredPrompt = null;
        
        // Remove install banner
        const banner = document.querySelector('.pwa-install-banner');
        if (banner) banner.remove();
      });
    }
  }

  // Check if running as PWA
  function isPWA() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  // Smooth Scroll for Anchor Links
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href !== '#' && href !== '#!') {
          e.preventDefault();
          const target = document.querySelector(href);
          if (target) {
            target.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
        }
      });
    });
  }

  // Enhanced Mobile Touch Support
  function initTouchSupport() {
    // Add touch-friendly classes
    document.documentElement.classList.add('touch-enabled');
    
    // Improve touch targets
    const touchTargets = document.querySelectorAll('button, a, input, select, textarea');
    touchTargets.forEach(target => {
      const rect = target.getBoundingClientRect();
      if (rect.width < 44 || rect.height < 44) {
        target.style.minWidth = '44px';
        target.style.minHeight = '44px';
      }
    });
    
    // Add touch feedback
    document.addEventListener('touchstart', function(e) {
      if (e.target.matches('button, .btn, a[role="button"]')) {
        e.target.classList.add('touch-active');
      }
    }, { passive: true });
    
    document.addEventListener('touchend', function(e) {
      if (e.target.matches('button, .btn, a[role="button"]')) {
        setTimeout(() => {
          e.target.classList.remove('touch-active');
        }, 150);
      }
    }, { passive: true });
    
    // Prevent zoom on double tap for form inputs
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(e) {
      const now = (new Date()).getTime();
      if (now - lastTouchEnd <= 300) {
        if (e.target.matches('input, textarea, select')) {
          e.preventDefault();
        }
      }
      lastTouchEnd = now;
    }, false);
  }

  // Responsive Image Loading
  function initResponsiveImages() {
    // Use Intersection Observer for lazy loading
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            
            // Load appropriate image size based on viewport
            if (img.dataset.src) {
              const viewportWidth = window.innerWidth;
              let imageSize = '400x400';
              
              if (viewportWidth >= 1200) {
                imageSize = '800x800';
              } else if (viewportWidth >= 768) {
                imageSize = '600x600';
              } else if (viewportWidth >= 480) {
                imageSize = '400x400';
              } else {
                imageSize = '300x300';
              }
              
              // If it's a Shopify image URL, add size parameter
              let imageSrc = img.dataset.src;
              if (imageSrc.includes('shopify.com') && !imageSrc.includes('_')) {
                imageSrc = imageSrc.replace(/\.(jpg|jpeg|png|webp)/i, `_${imageSize}.$1`);
              }
              
              img.src = imageSrc;
              img.removeAttribute('data-src');
              img.classList.add('loaded');
            }
            
            observer.unobserve(img);
          }
        });
      }, {
        rootMargin: '50px 0px',
        threshold: 0.01
      });

      // Observe all images with data-src
      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }
  }

  // Performance Monitoring
  function initPerformanceMonitoring() {
    // Monitor Core Web Vitals
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          console.log('LCP:', entry.startTime);
          // Track LCP if analytics available
          if (typeof gtag !== 'undefined') {
            gtag('event', 'web_vitals', {
              event_category: 'performance',
              event_label: 'LCP',
              value: Math.round(entry.startTime)
            });
          }
        }
      }).observe({ entryTypes: ['largest-contentful-paint'] });
      
      // First Input Delay
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          console.log('FID:', entry.processingStart - entry.startTime);
          if (typeof gtag !== 'undefined') {
            gtag('event', 'web_vitals', {
              event_category: 'performance',
              event_label: 'FID',
              value: Math.round(entry.processingStart - entry.startTime)
            });
          }
        }
      }).observe({ entryTypes: ['first-input'] });
      
      // Cumulative Layout Shift
      let clsValue = 0;
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        console.log('CLS:', clsValue);
      }).observe({ entryTypes: ['layout-shift'] });
    }
  }

  // Handle Offline Status
  function handleConnectionChange() {
    const isOnline = navigator.onLine;
    
    if (!isOnline) {
      showOfflineNotification();
    } else {
      hideOfflineNotification();
    }
  }

  function showOfflineNotification() {
    let notification = document.querySelector('.offline-notification');
    
    if (!notification) {
      notification = document.createElement('div');
      notification.className = 'offline-notification';
      notification.innerHTML = `
        <p>You're currently offline. Some features may be limited.</p>
      `;
      notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #ef4444;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 9999;
        font-size: 0.875rem;
      `;
      document.body.appendChild(notification);
    }
  }

  function hideOfflineNotification() {
    const notification = document.querySelector('.offline-notification');
    if (notification) {
      notification.remove();
    }
  }

  // Initialize on DOM Ready
  function init() {
    initMobileMenu();
    updateCartCount();
    initSmoothScroll();
    initTouchSupport();
    initResponsiveImages();
    initPerformanceMonitoring();
    
    // Check connection status
    handleConnectionChange();
    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);
    
    // Handle viewport changes for responsive design
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        // Re-initialize responsive images on significant viewport changes
        const viewportWidth = window.innerWidth;
        document.documentElement.style.setProperty('--viewport-width', `${viewportWidth}px`);
      }, 250);
    });
    
    // Set initial viewport width
    document.documentElement.style.setProperty('--viewport-width', `${window.innerWidth}px`);
    
    // Log PWA status
    if (isPWA()) {
      console.log('Running as PWA');
      document.documentElement.classList.add('pwa-mode');
    }
    
    // Initialize service worker communication
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      // Listen for service worker messages
      navigator.serviceWorker.addEventListener('message', (event) => {
        switch (event.data.type) {
          case 'CACHE_UPDATED':
            showUpdateAvailableNotification();
            break;
          case 'DESIGN_REQUEST_COMPLETED':
            handleDesignRequestCompleted(event.data.requestId, event.data.result);
            break;
          default:
            console.log('[Theme] Unknown SW message:', event.data.type);
        }
      });
      
      // Initialize offline storage
      if (window.offlineStorage) {
        window.offlineStorage.init().then(() => {
          console.log('[Theme] Offline storage initialized');
          // Clean up old data periodically
          window.offlineStorage.clearOldData();
        }).catch(error => {
          console.error('[Theme] Failed to initialize offline storage:', error);
        });
      }
    }
  }

  // Run initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Show update available notification
  function showUpdateAvailableNotification() {
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
      <div class="update-content">
        <span>A new version is available!</span>
        <button onclick="window.location.reload()" class="btn-update">Update</button>
        <button onclick="this.closest('.update-notification').remove()" class="btn-dismiss">×</button>
      </div>
    `;
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 1rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 9999;
      font-size: 0.875rem;
      max-width: 300px;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      .update-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .btn-update {
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        cursor: pointer;
      }
      .btn-update:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      .btn-dismiss {
        background: none;
        border: none;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(notification);
    
    // Auto-dismiss after 8 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 8000);
  }

  // Handle completed design request from service worker
  function handleDesignRequestCompleted(requestId, result) {
    console.log('[Theme] Design request completed:', requestId, result);
    
    // Show completion notification
    const notification = document.createElement('div');
    notification.className = 'design-completed-notification';
    notification.innerHTML = `
      <div class="notification-content">
        <span>✅ Your design is ready!</span>
        <button onclick="viewDesignResult('${requestId}')" class="btn-view">View</button>
        <button onclick="this.closest('.design-completed-notification').remove()" class="btn-dismiss">×</button>
      </div>
    `;
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 1rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 9999;
      font-size: 0.875rem;
      max-width: 300px;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      .notification-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .design-completed-notification .btn-view {
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        cursor: pointer;
      }
      .design-completed-notification .btn-view:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      .design-completed-notification .btn-dismiss {
        background: none;
        border: none;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(notification);
    
    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 10000);
  }

  // View design result
  async function viewDesignResult(requestId) {
    if (window.offlineStorage) {
      try {
        // Get the completed design request from storage
        const request = await window.offlineStorage.getDesignRequest(requestId);
        if (request && request.result) {
          // Navigate to design preview or show modal
          console.log('Design result:', request.result);
          // Implementation would depend on your design preview system
        }
      } catch (error) {
        console.error('Error viewing design result:', error);
      }
    }
  }

})();
  // Expose functions globally
  window.themeUtils = {
    updateCartCount,
    installPWA,
    isPWA,
    showInstallPromotion,
    showUpdateAvailableNotification,
    queueCartOperation,
    queueDesignRequest,
    handleDesignRequestCompleted,
    viewDesignResult
  };