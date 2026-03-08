/**
 * Mobile Performance Optimizations
 * Handles responsive image loading, lazy loading for design previews,
 * image optimization utilities (WebP detection, responsive sizing),
 * and performance monitoring.
 *
 * Requirements: 22.11, 22.12, 16.2, 16.3
 */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Configuration                                                      */
  /* ------------------------------------------------------------------ */

  var LAZY_LOAD_ROOT_MARGIN = '200px 0px';
  var LAZY_LOAD_THRESHOLD = 0.01;
  var DESIGN_RENDER_TARGET_MS = 2000; // Req 16.3: 2s render target
  var PAGE_LOAD_TARGET_MS = 3000;     // Req 22.11, 16.2: 3s load target

  /* ------------------------------------------------------------------ */
  /*  WebP Support Detection                                             */
  /* ------------------------------------------------------------------ */

  var supportsWebP = false;

  function detectWebPSupport() {
    if (typeof createImageBitmap !== 'undefined') {
      var webpData = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiTjt7REA';
      fetch(webpData)
        .then(function (r) { return r.blob(); })
        .then(function (blob) { return createImageBitmap(blob); })
        .then(function () { supportsWebP = true; })
        .catch(function () { supportsWebP = false; });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Responsive Image Utilities                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Shopify image URL size helper.
   * Converts a Shopify CDN URL to request a specific width.
   * e.g. image.jpg → image_400x.jpg  or uses Shopify's width param.
   *
   * @param {string} url - Original image URL
   * @param {number} width - Desired width in pixels
   * @returns {string} Resized image URL
   */
  function getResizedImageUrl(url, width) {
    if (!url) return '';

    // Shopify CDN URLs support width parameter
    if (url.indexOf('cdn.shopify.com') !== -1) {
      // Replace existing size parameter or add one
      var sizePattern = /_(\d+x(\d+)?)\./;
      if (sizePattern.test(url)) {
        return url.replace(sizePattern, '_' + width + 'x.');
      }
      // Add size before file extension
      var dotIndex = url.lastIndexOf('.');
      if (dotIndex !== -1) {
        return url.substring(0, dotIndex) + '_' + width + 'x' + url.substring(dotIndex);
      }
    }

    return url;
  }

  /**
   * Build a srcset string for responsive images.
   * Generates multiple sizes for the browser to choose from.
   *
   * @param {string} baseUrl - Base image URL
   * @param {number[]} widths - Array of widths to generate
   * @returns {string} srcset attribute value
   */
  function buildSrcSet(baseUrl, widths) {
    if (!baseUrl) return '';
    return widths.map(function (w) {
      return getResizedImageUrl(baseUrl, w) + ' ' + w + 'w';
    }).join(', ');
  }

  /**
   * Default responsive widths for different image contexts.
   */
  var RESPONSIVE_WIDTHS = {
    hero: [400, 600, 800, 1200],
    productCard: [200, 300, 400, 600],
    designPreview: [300, 400, 600, 800],
    thumbnail: [100, 150, 200, 300]
  };

  /**
   * Default sizes attributes for different contexts.
   */
  var RESPONSIVE_SIZES = {
    hero: '(max-width: 749px) 100vw, 50vw',
    productCard: '(max-width: 749px) 100vw, (max-width: 989px) 50vw, 25vw',
    designPreview: '(max-width: 749px) 90vw, (max-width: 989px) 45vw, 400px',
    thumbnail: '(max-width: 749px) 33vw, 150px'
  };

  /* ------------------------------------------------------------------ */
  /*  Lazy Loading with IntersectionObserver                             */
  /* ------------------------------------------------------------------ */

  var lazyObserver = null;

  /**
   * Initialize the IntersectionObserver for lazy loading images.
   * Falls back to immediate loading if IntersectionObserver is unavailable.
   */
  function initLazyLoading() {
    if (!('IntersectionObserver' in window)) {
      // Fallback: load all lazy images immediately
      loadAllLazyImages();
      return;
    }

    lazyObserver = new IntersectionObserver(handleLazyIntersection, {
      rootMargin: LAZY_LOAD_ROOT_MARGIN,
      threshold: LAZY_LOAD_THRESHOLD
    });

    observeLazyImages();
  }

  /**
   * IntersectionObserver callback for lazy images.
   */
  function handleLazyIntersection(entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        loadLazyImage(entry.target);
        lazyObserver.unobserve(entry.target);
      }
    });
  }

  /**
   * Find and observe all images marked for lazy loading.
   */
  function observeLazyImages() {
    var images = document.querySelectorAll('img[data-lazy-src], img[data-srcset]');
    images.forEach(function (img) {
      if (!img.dataset.lazyLoaded) {
        lazyObserver.observe(img);
      }
    });
  }

  /**
   * Load a single lazy image by swapping data attributes to real ones.
   *
   * @param {HTMLImageElement} img
   */
  function loadLazyImage(img) {
    if (img.dataset.lazyLoaded) return;

    var startTime = performance.now();

    // Swap data-lazy-src → src
    if (img.dataset.lazySrc) {
      img.src = img.dataset.lazySrc;
    }

    // Swap data-srcset → srcset
    if (img.dataset.srcset) {
      img.srcset = img.dataset.srcset;
    }

    // Swap data-sizes → sizes
    if (img.dataset.sizes) {
      img.sizes = img.dataset.sizes;
    }

    img.dataset.lazyLoaded = 'true';
    img.classList.add('lazy-loaded');

    // Track load time for design preview images (Req 16.3)
    if (img.closest('.design-preview') || img.closest('.design-card')) {
      img.addEventListener('load', function () {
        var loadTime = performance.now() - startTime;
        if (loadTime > DESIGN_RENDER_TARGET_MS) {
          console.warn('[MobilePerf] Design image load exceeded 2s target:', Math.round(loadTime) + 'ms');
        }
      }, { once: true });
    }
  }

  /**
   * Fallback: load all lazy images immediately.
   */
  function loadAllLazyImages() {
    var images = document.querySelectorAll('img[data-lazy-src], img[data-srcset]');
    images.forEach(loadLazyImage);
  }

  /* ------------------------------------------------------------------ */
  /*  Dynamic Design Preview Image Loading                               */
  /* ------------------------------------------------------------------ */

  /**
   * Load a design preview image with responsive sizing and performance
   * tracking. Called by design-preview.js and design-generation.js when
   * setting image sources dynamically.
   *
   * @param {HTMLImageElement} img - Target image element
   * @param {string} url - Design image URL
   * @param {string} context - Image context ('designPreview' | 'thumbnail')
   */
  function loadDesignImage(img, url, context) {
    if (!img || !url) return;

    var startTime = performance.now();
    context = context || 'designPreview';

    // For S3/external URLs, load directly (no Shopify CDN resizing)
    img.src = url;

    // Add loading="lazy" for below-fold images
    if (!isAboveFold(img)) {
      img.loading = 'lazy';
    }

    // Decode asynchronously to avoid blocking main thread
    if (img.decode) {
      img.decode().then(function () {
        var renderTime = performance.now() - startTime;
        trackImagePerformance(renderTime, context);
      }).catch(function () {
        // Decode failed, image will still render normally
      });
    }

    img.addEventListener('load', function () {
      var loadTime = performance.now() - startTime;
      trackImagePerformance(loadTime, context);
    }, { once: true });
  }

  /**
   * Check if an element is above the fold (visible without scrolling).
   */
  function isAboveFold(el) {
    var rect = el.getBoundingClientRect();
    return rect.top < window.innerHeight;
  }

  /**
   * Track image load performance metrics.
   */
  function trackImagePerformance(loadTimeMs, context) {
    if (context === 'designPreview' && loadTimeMs > DESIGN_RENDER_TARGET_MS) {
      console.warn('[MobilePerf] Design preview render: ' + Math.round(loadTimeMs) + 'ms (target: ' + DESIGN_RENDER_TARGET_MS + 'ms)');
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Upgrade existing <img> tags with responsive attributes             */
  /* ------------------------------------------------------------------ */

  /**
   * Enhance existing Shopify product images with srcset and sizes
   * for responsive loading. Runs once on page load.
   */
  function upgradeProductImages() {
    // Hero images
    var heroImages = document.querySelectorAll('.hero-image img');
    heroImages.forEach(function (img) {
      upgradeImage(img, 'hero');
    });

    // Product card images
    var productImages = document.querySelectorAll('.product-card-image img');
    productImages.forEach(function (img) {
      upgradeImage(img, 'productCard');
    });

    // Design example images
    var exampleImages = document.querySelectorAll('.example-item img');
    exampleImages.forEach(function (img) {
      upgradeImage(img, 'thumbnail');
    });
  }

  /**
   * Add srcset and sizes to an image if it's a Shopify CDN image.
   *
   * @param {HTMLImageElement} img
   * @param {string} context - One of 'hero', 'productCard', 'designPreview', 'thumbnail'
   */
  function upgradeImage(img, context) {
    if (!img || !img.src) return;
    // Only upgrade Shopify CDN images
    if (img.src.indexOf('cdn.shopify.com') === -1) return;
    // Don't upgrade if already has srcset
    if (img.srcset) return;

    var widths = RESPONSIVE_WIDTHS[context] || RESPONSIVE_WIDTHS.productCard;
    var sizes = RESPONSIVE_SIZES[context] || RESPONSIVE_SIZES.productCard;

    var srcset = buildSrcSet(img.src, widths);
    if (srcset) {
      img.srcset = srcset;
      img.sizes = sizes;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Connection-Aware Loading                                           */
  /* ------------------------------------------------------------------ */

  /**
   * Get the effective connection type for adaptive loading.
   * Returns 'slow' for 2G/slow-2g, 'medium' for 3G, 'fast' for 4G+.
   */
  function getConnectionQuality() {
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return 'fast'; // Assume fast if API unavailable

    var ect = conn.effectiveType;
    if (ect === 'slow-2g' || ect === '2g') return 'slow';
    if (ect === '3g') return 'medium';
    return 'fast';
  }

  /**
   * Get recommended image quality based on connection.
   * Returns a width multiplier (0.5 for slow, 0.75 for medium, 1 for fast).
   */
  function getImageQualityMultiplier() {
    var quality = getConnectionQuality();
    if (quality === 'slow') return 0.5;
    if (quality === 'medium') return 0.75;
    return 1;
  }

  /* ------------------------------------------------------------------ */
  /*  Page Load Performance Monitoring                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Monitor page load performance and log warnings if targets are missed.
   * Req 22.11: 3s page load on 4G
   * Req 16.2: 3s customization page load
   */
  function monitorPageLoad() {
    if (!window.performance || !window.performance.timing) return;

    window.addEventListener('load', function () {
      // Use requestIdleCallback or setTimeout to avoid blocking
      var check = window.requestIdleCallback || function (cb) { setTimeout(cb, 100); };
      check(function () {
        var timing = performance.timing;
        var pageLoadTime = timing.loadEventEnd - timing.navigationStart;

        if (pageLoadTime > PAGE_LOAD_TARGET_MS) {
          console.warn('[MobilePerf] Page load: ' + pageLoadTime + 'ms (target: ' + PAGE_LOAD_TARGET_MS + 'ms)');
        }

        // Log key metrics
        var metrics = {
          dns: timing.domainLookupEnd - timing.domainLookupStart,
          tcp: timing.connectEnd - timing.connectStart,
          ttfb: timing.responseStart - timing.navigationStart,
          domReady: timing.domContentLoadedEventEnd - timing.navigationStart,
          fullLoad: pageLoadTime
        };

        if (window.console && console.table) {
          console.log('[MobilePerf] Page load metrics:');
          console.table(metrics);
        }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Deferred Non-Critical Resource Loading                             */
  /* ------------------------------------------------------------------ */

  /**
   * Defer loading of non-critical CSS by converting preload links
   * to stylesheets after the page has loaded.
   */
  function deferNonCriticalCSS() {
    window.addEventListener('load', function () {
      var deferred = document.querySelectorAll('link[data-defer-css]');
      deferred.forEach(function (link) {
        link.rel = 'stylesheet';
        link.removeAttribute('data-defer-css');
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /*  MutationObserver for dynamically added images                      */
  /* ------------------------------------------------------------------ */

  /**
   * Watch for dynamically added images (e.g., from design generation)
   * and apply lazy loading + responsive attributes.
   */
  function watchForNewImages() {
    if (!('MutationObserver' in window)) return;

    var observer = new MutationObserver(function (mutations) {
      var hasNewImages = false;
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) {
            if (node.tagName === 'IMG') {
              hasNewImages = true;
            } else if (node.querySelectorAll) {
              var imgs = node.querySelectorAll('img');
              if (imgs.length > 0) hasNewImages = true;
            }
          }
        });
      });

      if (hasNewImages) {
        // Re-observe any new lazy images
        if (lazyObserver) {
          observeLazyImages();
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Init                                                               */
  /* ------------------------------------------------------------------ */

  function init() {
    detectWebPSupport();
    initLazyLoading();
    upgradeProductImages();
    deferNonCriticalCSS();
    watchForNewImages();
    monitorPageLoad();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  window.MobilePerformance = {
    loadDesignImage: loadDesignImage,
    upgradeImage: upgradeImage,
    buildSrcSet: buildSrcSet,
    getResizedImageUrl: getResizedImageUrl,
    getConnectionQuality: getConnectionQuality,
    getImageQualityMultiplier: getImageQualityMultiplier,
    supportsWebP: function () { return supportsWebP; },
    RESPONSIVE_WIDTHS: RESPONSIVE_WIDTHS,
    RESPONSIVE_SIZES: RESPONSIVE_SIZES
  };
})();
