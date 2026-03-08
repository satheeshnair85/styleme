/**
 * PWA Features - Install Prompt, Offline Queueing, Network Sync
 * Implements Req 23.1, 23.3, 23.8, 23.9, 23.10
 */

(function() {
  'use strict';

  // ── Add to Home Screen / Install Prompt (Req 23.3) ──

  let deferredInstallPrompt = null;
  let installBannerEl = null;

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    showInstallBanner();
  });

  window.addEventListener('appinstalled', function() {
    deferredInstallPrompt = null;
    hideInstallBanner();
    console.log('[PWA] App installed successfully');
  });

  function showInstallBanner() {
    // Don't show if already dismissed this session
    if (sessionStorage.getItem('pwa-install-dismissed')) return;

    if (!installBannerEl) {
      installBannerEl = document.createElement('div');
      installBannerEl.id = 'pwa-install-banner';
      installBannerEl.setAttribute('role', 'alert');
      installBannerEl.innerHTML =
        '<div class="pwa-install-content">' +
          '<div class="pwa-install-text">' +
            '<strong>Install AI Merch</strong>' +
            '<span>Add to home screen for quick access &amp; offline browsing</span>' +
          '</div>' +
          '<div class="pwa-install-actions">' +
            '<button class="pwa-install-btn" id="pwa-install-accept">Install</button>' +
            '<button class="pwa-install-dismiss" id="pwa-install-dismiss" aria-label="Dismiss install prompt">&times;</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(installBannerEl);

      document.getElementById('pwa-install-accept').addEventListener('click', handleInstallClick);
      document.getElementById('pwa-install-dismiss').addEventListener('click', dismissInstallBanner);
    }

    installBannerEl.classList.add('pwa-install-visible');
  }

  function hideInstallBanner() {
    if (installBannerEl) {
      installBannerEl.classList.remove('pwa-install-visible');
    }
  }

  function dismissInstallBanner() {
    hideInstallBanner();
    sessionStorage.setItem('pwa-install-dismissed', '1');
  }

  async function handleInstallClick() {
    if (!deferredInstallPrompt) return;

    deferredInstallPrompt.prompt();
    var result = await deferredInstallPrompt.userChoice;
    console.log('[PWA] Install prompt result:', result.outcome);
    deferredInstallPrompt = null;
    hideInstallBanner();
  }

  // Expose for external use
  window.pwaInstall = {
    canInstall: function() { return !!deferredInstallPrompt; },
    promptInstall: handleInstallClick
  };

  // ── Network Status Detection & Offline Indicator (Req 23.9, 23.10) ──

  var isOnline = navigator.onLine;
  var offlineIndicatorEl = null;
  var pendingQueueBadgeEl = null;

  function createOfflineIndicator() {
    offlineIndicatorEl = document.createElement('div');
    offlineIndicatorEl.id = 'pwa-offline-indicator';
    offlineIndicatorEl.setAttribute('role', 'status');
    offlineIndicatorEl.setAttribute('aria-live', 'polite');
    offlineIndicatorEl.innerHTML =
      '<span class="pwa-offline-icon">&#9888;</span>' +
      '<span class="pwa-offline-text">You are offline</span>' +
      '<span class="pwa-pending-badge" id="pwa-pending-badge" style="display:none"></span>';
    document.body.appendChild(offlineIndicatorEl);
    pendingQueueBadgeEl = document.getElementById('pwa-pending-badge');
  }

  function updateOnlineStatus() {
    var wasOffline = !isOnline;
    isOnline = navigator.onLine;

    if (!offlineIndicatorEl) createOfflineIndicator();

    if (isOnline) {
      offlineIndicatorEl.classList.remove('pwa-offline-visible');
      // Sync queued actions when coming back online (Req 23.10)
      if (wasOffline) {
        syncQueuedActions();
      }
    } else {
      offlineIndicatorEl.classList.add('pwa-offline-visible');
      updatePendingBadge();
    }
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // ── Offline Design Generation Queueing (Req 23.9) ──

  /**
   * Queue a design generation request when offline.
   * Returns the queued request ID, or null if online (caller should proceed normally).
   */
  async function queueDesignRequestIfOffline(prompt, productType, sessionId) {
    if (navigator.onLine) return null;

    var storage = window.offlineStorage;
    if (!storage) {
      console.warn('[PWA] offlineStorage not available');
      return null;
    }

    await storage.init();
    var id = await storage.queueDesignRequest({
      prompt: prompt,
      productType: productType,
      sessionId: sessionId
    });

    showQueuedNotification();
    updatePendingBadge();
    return id;
  }

  function showQueuedNotification() {
    var el = document.createElement('div');
    el.className = 'pwa-queued-toast';
    el.setAttribute('role', 'alert');
    el.textContent = 'Design request queued — it will process when you\'re back online.';
    document.body.appendChild(el);

    // Animate in
    requestAnimationFrame(function() { el.classList.add('pwa-toast-visible'); });

    setTimeout(function() {
      el.classList.remove('pwa-toast-visible');
      setTimeout(function() { el.remove(); }, 300);
    }, 4000);
  }

  async function updatePendingBadge() {
    if (!pendingQueueBadgeEl || !window.offlineStorage) return;

    try {
      await window.offlineStorage.init();
      var queued = await window.offlineStorage.getQueuedDesignRequests();
      var pending = await window.offlineStorage.getPendingCartOperations();
      var total = queued.length + pending.length;

      if (total > 0) {
        pendingQueueBadgeEl.textContent = total + ' pending';
        pendingQueueBadgeEl.style.display = '';
      } else {
        pendingQueueBadgeEl.style.display = 'none';
      }
    } catch (e) {
      console.warn('[PWA] Could not update pending badge:', e);
    }
  }

  // ── Sync Queued Actions on Reconnect (Req 23.10) ──

  async function syncQueuedActions() {
    console.log('[PWA] Network restored, syncing queued actions...');

    // Try Background Sync API first
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        var reg = await navigator.serviceWorker.ready;
        await reg.sync.register('sync-design-requests');
        await reg.sync.register('sync-cart');
        console.log('[PWA] Background sync registered');
        showSyncNotification('Syncing your queued requests...');
        return;
      } catch (e) {
        console.warn('[PWA] Background sync registration failed, falling back:', e);
      }
    }

    // Fallback: sync directly from main thread
    await syncDesignRequestsFallback();
    await syncCartOperationsFallback();
    updatePendingBadge();
  }

  async function syncDesignRequestsFallback() {
    if (!window.offlineStorage) return;

    try {
      await window.offlineStorage.init();
      var queued = await window.offlineStorage.getQueuedDesignRequests();

      for (var i = 0; i < queued.length; i++) {
        var req = queued[i];
        try {
          var response = await fetch('/api/generate-design', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: req.prompt,
              productType: req.productType,
              sessionId: req.sessionId
            })
          });

          if (response.ok) {
            var result = await response.json();
            await window.offlineStorage.updateDesignRequestStatus(req.id, 'completed', result);
            showSyncNotification('Design request completed!');
          } else {
            await window.offlineStorage.updateDesignRequestStatus(req.id, 'failed');
          }
        } catch (e) {
          console.error('[PWA] Failed to sync design request:', req.id, e);
        }
      }
    } catch (e) {
      console.error('[PWA] Design sync fallback failed:', e);
    }
  }

  async function syncCartOperationsFallback() {
    if (!window.offlineStorage) return;

    try {
      await window.offlineStorage.init();
      var pending = await window.offlineStorage.getPendingCartOperations();

      for (var i = 0; i < pending.length; i++) {
        var op = pending[i];
        try {
          var response = await fetch(op.url, {
            method: op.method,
            headers: op.headers,
            body: op.body
          });

          if (response.ok) {
            await window.offlineStorage.markCartOperationComplete(op.id);
          }
        } catch (e) {
          console.error('[PWA] Failed to sync cart operation:', op.id, e);
        }
      }
    } catch (e) {
      console.error('[PWA] Cart sync fallback failed:', e);
    }
  }

  function showSyncNotification(message) {
    var el = document.createElement('div');
    el.className = 'pwa-queued-toast pwa-sync-toast';
    el.setAttribute('role', 'status');
    el.textContent = message;
    document.body.appendChild(el);

    requestAnimationFrame(function() { el.classList.add('pwa-toast-visible'); });

    setTimeout(function() {
      el.classList.remove('pwa-toast-visible');
      setTimeout(function() { el.remove(); }, 300);
    }, 3000);
  }

  // ── Listen for service worker messages about completed syncs ──

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'DESIGN_REQUEST_COMPLETED') {
        showSyncNotification('Your queued design is ready!');
        updatePendingBadge();
      }
    });
  }

  // ── Product Catalog Caching Helper (Req 23.8) ──

  async function cacheProductCatalog() {
    if (!navigator.onLine) return;

    try {
      var response = await fetch('/products.json');
      if (!response.ok) return;

      var data = await response.json();
      var products = data.products || [];

      if (window.offlineStorage) {
        await window.offlineStorage.init();
        for (var i = 0; i < products.length; i++) {
          await window.offlineStorage.cacheProduct(products[i]);
        }
      }

      // Also cache product images via the service worker cache
      if ('caches' in window) {
        var cache = await caches.open('ai-merch-images-v1.1.0');
        var imageUrls = [];
        for (var j = 0; j < products.length; j++) {
          var p = products[j];
          if (p.images) {
            for (var k = 0; k < p.images.length; k++) {
              if (p.images[k].src) imageUrls.push(p.images[k].src);
            }
          }
        }
        // Cache images in batches to avoid overwhelming the network
        var batch = imageUrls.slice(0, 20);
        await Promise.allSettled(batch.map(function(url) {
          return cache.add(url).catch(function() {});
        }));
      }

      console.log('[PWA] Product catalog cached:', products.length, 'products');
    } catch (e) {
      console.warn('[PWA] Failed to cache product catalog:', e);
    }
  }

  // ── Expose public API ──

  window.pwaFeatures = {
    queueDesignRequest: queueDesignRequestIfOffline,
    syncQueuedActions: syncQueuedActions,
    cacheProductCatalog: cacheProductCatalog,
    isOnline: function() { return isOnline; },
    updatePendingBadge: updatePendingBadge
  };

  // ── Initialize ──

  document.addEventListener('DOMContentLoaded', function() {
    updateOnlineStatus();
    // Cache product catalog on first load
    cacheProductCatalog();
  });

})();
