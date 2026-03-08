/**
 * Offline Storage Manager
 * Handles IndexedDB operations for offline functionality
 */

class OfflineStorage {
  constructor() {
    this.dbName = 'ai-merch-offline';
    this.dbVersion = 1;
    this.db = null;
  }

  // Initialize IndexedDB
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('cart-operations')) {
          const cartStore = db.createObjectStore('cart-operations', { keyPath: 'id', autoIncrement: true });
          cartStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('design-requests')) {
          const designStore = db.createObjectStore('design-requests', { keyPath: 'id', autoIncrement: true });
          designStore.createIndex('timestamp', 'timestamp', { unique: false });
          designStore.createIndex('status', 'status', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('product-cache')) {
          const productStore = db.createObjectStore('product-cache', { keyPath: 'id' });
          productStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('user-preferences')) {
          db.createObjectStore('user-preferences', { keyPath: 'key' });
        }
      };
    });
  }

  // Queue cart operation for sync when online
  async queueCartOperation(operation) {
    if (!this.db) await this.init();
    
    const transaction = this.db.transaction(['cart-operations'], 'readwrite');
    const store = transaction.objectStore('cart-operations');
    
    const operationData = {
      ...operation,
      timestamp: Date.now(),
      status: 'pending'
    };
    
    return new Promise((resolve, reject) => {
      const request = store.add(operationData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get pending cart operations
  async getPendingCartOperations() {
    if (!this.db) await this.init();
    
    const transaction = this.db.transaction(['cart-operations'], 'readonly');
    const store = transaction.objectStore('cart-operations');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const operations = request.result.filter(op => op.status === 'pending');
        resolve(operations);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Mark cart operation as completed
  async markCartOperationComplete(id) {
    if (!this.db) await this.init();
    
    const transaction = this.db.transaction(['cart-operations'], 'readwrite');
    const store = transaction.objectStore('cart-operations');
    
    return new Promise((resolve, reject) => {
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
          resolve(); // Operation not found, consider it completed
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Queue design request for sync when online
  async queueDesignRequest(request) {
    if (!this.db) await this.init();
    
    const transaction = this.db.transaction(['design-requests'], 'readwrite');
    const store = transaction.objectStore('design-requests');
    
    const requestData = {
      ...request,
      timestamp: Date.now(),
      status: 'queued'
    };
    
    return new Promise((resolve, reject) => {
      const dbRequest = store.add(requestData);
      dbRequest.onsuccess = () => resolve(dbRequest.result);
      dbRequest.onerror = () => reject(dbRequest.error);
    });
  }

  // Get queued design requests
  async getQueuedDesignRequests() {
    if (!this.db) await this.init();
    
    const transaction = this.db.transaction(['design-requests'], 'readonly');
    const store = transaction.objectStore('design-requests');
    const index = store.index('status');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll('queued');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Update design request status
  async updateDesignRequestStatus(id, status, result = null) {
    if (!this.db) await this.init();
    
    const transaction = this.db.transaction(['design-requests'], 'readwrite');
    const store = transaction.objectStore('design-requests');
    
    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const request = getRequest.result;
        if (request) {
          request.status = status;
          request.updatedAt = Date.now();
          if (result) {
            request.result = result;
          }
          
          const putRequest = store.put(request);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error('Design request not found'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Cache product data
  async cacheProduct(product) {
    if (!this.db) await this.init();
    
    const transaction = this.db.transaction(['product-cache'], 'readwrite');
    const store = transaction.objectStore('product-cache');
    
    const productData = {
      ...product,
      lastUpdated: Date.now()
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(productData);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Get cached product
  async getCachedProduct(id) {
    if (!this.db) await this.init();
    
    const transaction = this.db.transaction(['product-cache'], 'readonly');
    const store = transaction.objectStore('product-cache');
    
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const product = request.result;
        // Check if cache is still valid (24 hours)
        if (product && (Date.now() - product.lastUpdated) < 24 * 60 * 60 * 1000) {
          resolve(product);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get all cached products
  async getAllCachedProducts() {
    if (!this.db) await this.init();
    
    const transaction = this.db.transaction(['product-cache'], 'readonly');
    const store = transaction.objectStore('product-cache');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const products = request.result.filter(product => 
          (Date.now() - product.lastUpdated) < 24 * 60 * 60 * 1000
        );
        resolve(products);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Save user preference
  async savePreference(key, value) {
    if (!this.db) await this.init();
    
    const transaction = this.db.transaction(['user-preferences'], 'readwrite');
    const store = transaction.objectStore('user-preferences');
    
    return new Promise((resolve, reject) => {
      const request = store.put({ key, value, updatedAt: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Get user preference
  async getPreference(key) {
    if (!this.db) await this.init();
    
    const transaction = this.db.transaction(['user-preferences'], 'readonly');
    const store = transaction.objectStore('user-preferences');
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Clear old data
  async clearOldData() {
    if (!this.db) await this.init();
    
    const transaction = this.db.transaction(['cart-operations', 'design-requests', 'product-cache'], 'readwrite');
    
    // Clear completed cart operations older than 7 days
    const cartStore = transaction.objectStore('cart-operations');
    const cartIndex = cartStore.index('timestamp');
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    const cartRange = IDBKeyRange.upperBound(weekAgo);
    cartIndex.openCursor(cartRange).onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (cursor.value.status === 'completed') {
          cursor.delete();
        }
        cursor.continue();
      }
    };
    
    // Clear old design requests (older than 30 days)
    const designStore = transaction.objectStore('design-requests');
    const designIndex = designStore.index('timestamp');
    const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    const designRange = IDBKeyRange.upperBound(monthAgo);
    designIndex.openCursor(designRange).onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    
    // Clear old product cache (older than 7 days)
    const productStore = transaction.objectStore('product-cache');
    const productIndex = productStore.index('lastUpdated');
    
    const productRange = IDBKeyRange.upperBound(weekAgo);
    productIndex.openCursor(productRange).onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  }
}

// Create global instance
window.offlineStorage = new OfflineStorage();