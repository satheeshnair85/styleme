/**
 * Service Worker for AI Custom Merchandise PWA
 * Implements comprehensive caching and offline functionality
 */

const CACHE_VERSION = 'v1.1.0';
const STATIC_CACHE = `ai-merch-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `ai-merch-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `ai-merch-images-${CACHE_VERSION}`;
const CATALOG_CACHE = `ai-merch-catalog-${CACHE_VERSION}`;

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/assets/theme.css',
  '/assets/theme.js',
  '/assets/base.css',
  '/assets/manifest.json',
  '/offline.html'
];

// Product catalog URLs to cache on install
const CATALOG_URLS = [
  '/products.json',
  '/collections.json',
  '/collections/all.json'
];

// Cache strategies for different resource types
const CACHE_STRATEGIES = {
  // Static assets - Cache first, network fallback
  static: [
    /\.css$/,
    /\.js$/,
    /\.woff2?$/,
    /\.ttf$/,
    /\.eot$/
  ],
  // Images - Cache first with stale-while-revalidate
  images: [
    /\.png$/,
    /\.jpg$/,
    /\.jpeg$/,
    /\.gif$/,
    /\.webp$/,
    /\.svg$/
  ],
  // Product catalog - Network first, cache fallback
  catalog: [
    /\/products\.json/,
    /\/products\//,
    /\/collections\/.*\.json$/,
    /\/collections\.json/
  ],
  // API calls - Network first, cache fallback
  api: [
    /\/cart\.js$/
  ]
};

// Install Event - Cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      // Cache product catalog for offline browsing (Req 23.8)
      caches.open(CATALOG_CACHE).then(cache => {
        console.log('[SW] Caching product catalog');
        return Promise.allSettled(
          CATALOG_URLS.map(url => cache.add(url).catch(err => {
            console.warn('[SW] Failed to cache catalog URL:', url, err);
          }))
        );
      }),
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => 
              name.startsWith('ai-merch-') && 
              !name.includes(CACHE_VERSION)
            )
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      }),
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

// Fetch Event - Implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and other protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip Shopify admin and checkout
  if (url.pathname.includes('/admin') || url.pathname.includes('/checkout')) {
    return;
  }

  event.respondWith(handleRequest(request));
});

// Handle different request types with appropriate strategies
async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  try {
    // Static assets - Cache first
    if (isStaticAsset(pathname)) {
      return await cacheFirst(request, STATIC_CACHE);
    }

    // Images - Cache first with stale-while-revalidate
    if (isImage(pathname)) {
      return await staleWhileRevalidate(request, IMAGE_CACHE);
    }

    // Product catalog - Network first with catalog cache (Req 23.8)
    if (isCatalogRequest(pathname)) {
      return await networkFirst(request, CATALOG_CACHE);
    }

    // API calls - Network first
    if (isApiCall(pathname)) {
      return await networkFirst(request, DYNAMIC_CACHE);
    }

    // HTML pages - Network first with cache fallback
    if (request.headers.get('accept')?.includes('text/html')) {
      return await networkFirst(request, DYNAMIC_CACHE);
    }

    // Default - Network first
    return await networkFirst(request, DYNAMIC_CACHE);

  } catch (error) {
    console.error('[SW] Request failed:', error);
    
    // Return offline page for HTML requests
    if (request.headers.get('accept')?.includes('text/html')) {
      return await caches.match('/offline.html') || new Response('Offline');
    }
    
    return new Response('Network error', { status: 408 });
  }
}

// Cache first strategy
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);
  
  if (networkResponse.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, networkResponse.clone());
  }

  return networkResponse;
}

// Network first strategy
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Stale while revalidate strategy
async function staleWhileRevalidate(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  const networkResponsePromise = fetch(request).then(response => {
    if (response.ok) {
      const cache = caches.open(cacheName);
      cache.then(c => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => null);

  return cachedResponse || await networkResponsePromise;
}

// Helper functions to determine request types
function isStaticAsset(pathname) {
  return CACHE_STRATEGIES.static.some(pattern => pattern.test(pathname));
}

function isImage(pathname) {
  return CACHE_STRATEGIES.images.some(pattern => pattern.test(pathname));
}

function isApiCall(pathname) {
  return CACHE_STRATEGIES.api.some(pattern => pattern.test(pathname));
}

function isCatalogRequest(pathname) {
  return CACHE_STRATEGIES.catalog.some(pattern => pattern.test(pathname));
}

// Background Sync - Sync data when back online
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  switch (event.tag) {
    case 'sync-cart':
      event.waitUntil(syncCart());
      break;
    case 'sync-design-requests':
      event.waitUntil(syncDesignRequests());
      break;
    default:
      console.log('[SW] Unknown sync tag:', event.tag);
  }
});

// Push Notification handling
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'AI Custom Merchandise';
  const options = {
    body: data.body || 'You have a new notification',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    image: data.image,
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    },
    actions: data.actions || [
      {
        action: 'view',
        title: 'View',
        icon: 'icon-192.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
    vibrate: data.vibrate || [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  const url = event.notification.data?.url || '/';
  
  if (event.action === 'dismiss') {
    return;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_VERSION });
      break;
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
    case 'CACHE_CATALOG':
      cacheCatalogOnDemand().then(() => {
        event.ports[0]?.postMessage({ success: true });
      });
      break;
    default:
      console.log('[SW] Unknown message type:', event.data.type);
  }
});

// Helper function to sync cart data
async function syncCart() {
  try {
    console.log('[SW] Syncing cart data...');
    
    // Get queued cart operations from IndexedDB
    const queuedOperations = await getQueuedCartOperations();
    
    for (const operation of queuedOperations) {
      try {
        const response = await fetch(operation.url, {
          method: operation.method,
          headers: operation.headers,
          body: operation.body
        });
        
        if (response.ok) {
          // Remove from queue on success
          await markCartOperationComplete(operation.id);
          console.log('[SW] Cart operation synced:', operation.id);
        } else {
          console.error('[SW] Cart sync operation failed:', response.status);
        }
      } catch (error) {
        console.error('[SW] Cart sync operation failed:', error);
      }
    }
    
    console.log('[SW] Cart sync completed');
  } catch (error) {
    console.error('[SW] Cart sync failed:', error);
  }
}

// Helper function to sync design requests
async function syncDesignRequests() {
  try {
    console.log('[SW] Syncing design requests...');
    
    const queuedRequests = await getQueuedDesignRequests();
    
    for (const request of queuedRequests) {
      try {
        const response = await fetch('/api/generate-design', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: request.prompt,
            productType: request.productType,
            sessionId: request.sessionId
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          await updateDesignRequestStatus(request.id, 'completed', result);
          
          // Notify the main thread about the completed request
          const clients = await self.clients.matchAll();
          clients.forEach(client => {
            client.postMessage({
              type: 'DESIGN_REQUEST_COMPLETED',
              requestId: request.id,
              result: result
            });
          });
          
          console.log('[SW] Design request completed:', request.id);
        } else {
          await updateDesignRequestStatus(request.id, 'failed');
          console.error('[SW] Design request failed:', response.status);
        }
      } catch (error) {
        await updateDesignRequestStatus(request.id, 'failed');
        console.error('[SW] Design request failed:', error);
      }
    }
    
    console.log('[SW] Design requests sync completed');
  } catch (error) {
    console.error('[SW] Design requests sync failed:', error);
  }
}

// IndexedDB helper functions for service worker
async function getQueuedCartOperations() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ai-merch-offline', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['cart-operations'], 'readonly');
      const store = transaction.objectStore('cart-operations');
      
      const getAllRequest = store.getAll();
      getAllRequest.onsuccess = () => {
        const operations = getAllRequest.result.filter(op => op.status === 'pending');
        resolve(operations);
      };
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

async function markCartOperationComplete(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ai-merch-offline', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['cart-operations'], 'readwrite');
      const store = transaction.objectStore('cart-operations');
      
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const operation = getRequest.result;
        if (operation) {
          operation.status = 'completed';
          operation.completedAt = Date.now();
          
          const putRequest = store.put(operation);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

async function getQueuedDesignRequests() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ai-merch-offline', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['design-requests'], 'readonly');
      const store = transaction.objectStore('design-requests');
      const index = store.index('status');
      
      const getRequest = index.getAll('queued');
      getRequest.onsuccess = () => resolve(getRequest.result);
      getRequest.onerror = () => reject(getRequest.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

async function updateDesignRequestStatus(id, status, result = null) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ai-merch-offline', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['design-requests'], 'readwrite');
      const store = transaction.objectStore('design-requests');
      
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const designRequest = getRequest.result;
        if (designRequest) {
          designRequest.status = status;
          designRequest.updatedAt = Date.now();
          if (result) {
            designRequest.result = result;
          }
          
          const putRequest = store.put(designRequest);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error('Design request not found'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Helper function to cache product catalog on demand (Req 23.8)
async function cacheCatalogOnDemand() {
  try {
    const cache = await caches.open(CATALOG_CACHE);
    await Promise.allSettled(
      CATALOG_URLS.map(url =>
        fetch(url)
          .then(response => {
            if (response.ok) return cache.put(url, response);
          })
          .catch(err => console.warn('[SW] Catalog cache failed for:', url, err))
      )
    );
    console.log('[SW] Product catalog cached on demand');
  } catch (error) {
    console.error('[SW] Catalog caching failed:', error);
  }
}

// Helper function to clear all caches
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  return Promise.all(
    cacheNames
      .filter(name => name.startsWith('ai-merch-'))
      .map(name => caches.delete(name))
  );
}