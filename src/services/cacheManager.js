/**
 * IndexedDB Cache Manager
 * 
 * Provides fast caching for Firestore queries using browser's IndexedDB.
 * Automatically handles TTL (time-to-live) expiration.
 * 
 * Usage:
 *   import { cacheManager } from '../services/cacheManager';
 *   
 *   // Get cached data or fetch fresh
 *   const data = await cacheManager.getOrFetch('customers', () => getAll('customers'), 5*60*1000);
 *   
 *   // Invalidate cache for a collection
 *   await cacheManager.invalidate('customers');
 *   
 *   // Clear all cache
 *   await cacheManager.clearAll();
 */

const DB_NAME = "wms-cache";
const STORE_NAME = "cache-entries";
const VERSION = 1;

class CacheManager {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  /**
   * Initialize IndexedDB connection
   */
  async init() {
    if (this.initialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, VERSION);

      request.onerror = () => {
        console.error("IndexedDB open error:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
          store.createIndex("expiry", "expiry", { unique: false });
        }
      };
    });
  }

  /**
   * Get cached entry
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value or null if expired/missing
   */
  async get(key) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result;

        // Return null if missing
        if (!entry) {
          resolve(null);
          return;
        }

        // Check if expired
        if (entry.expiry < Date.now()) {
          // Expired - delete it
          this.delete(key).catch(err => console.warn("Failed to delete expired cache:", err));
          resolve(null);
          return;
        }

        // Return cached value
        resolve(entry.value);
      };
    });
  }

  /**
   * Set cached entry with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  async set(key, value, ttl = 5 * 60 * 1000) {
    await this.init();

    const entry = {
      key,
      value,
      expiry: Date.now() + ttl,
      createdAt: Date.now(),
      ttlMs: ttl,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Get or fetch - returns cached value or fetches fresh
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Async function to fetch fresh data
   * @param {number} ttl - Cache TTL in milliseconds
   * @returns {Promise<{data: any, cached: boolean}>}
   */
  async getOrFetch(key, fetchFn, ttl = 5 * 60 * 1000) {
    try {
      // Try to get from cache
      const cached = await this.get(key);
      if (cached !== null) {
        return { data: cached, cached: true, source: "cache" };
      }
    } catch (err) {
      console.warn(`Cache get failed for ${key}:`, err);
      // Fall through to fetch fresh
    }

    // Not in cache - fetch fresh
    try {
      const data = await fetchFn();
      
      // Cache the result
      try {
        await this.set(key, data, ttl);
      } catch (cacheErr) {
        console.warn(`Failed to cache ${key}:`, cacheErr);
      }

      return { data, cached: false, source: "firestore" };
    } catch (err) {
      console.error(`Fetch failed for ${key}:`, err);
      throw err;
    }
  }

  /**
   * Delete single cache entry
   */
  async delete(key) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Invalidate all entries for a collection
   * @param {string} prefix - Cache key prefix (e.g., "customers")
   */
  async invalidate(prefix) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entries = request.result;
        const toDelete = entries.filter(e => e.key.startsWith(`${prefix}:`));

        toDelete.forEach(entry => {
          store.delete(entry.key);
        });

        resolve(toDelete.length);
      };
    });
  }

  /**
   * Clear all cache
   */
  async clearAll() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Get cache stats
   */
  async getStats() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entries = request.result;
        const now = Date.now();
        const valid = entries.filter(e => e.expiry >= now);
        const expired = entries.filter(e => e.expiry < now);
        const size = JSON.stringify(entries).length;

        resolve({
          totalEntries: entries.length,
          validEntries: valid.length,
          expiredEntries: expired.length,
          approximateSizeKb: Math.round(size / 1024),
          entries: entries.map(e => ({
            key: e.key,
            expiresIn: Math.round((e.expiry - now) / 1000) + 's',
            expired: e.expiry < now,
          })),
        });
      };
    });
  }

  /**
   * Clean up expired entries
   */
  async cleanup() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entries = request.result;
        const now = Date.now();
        let deleted = 0;

        entries.forEach(entry => {
          if (entry.expiry < now) {
            store.delete(entry.key);
            deleted++;
          }
        });

        resolve(deleted);
      };
    });
  }
}

// Singleton instance
export const cacheManager = new CacheManager();

/**
 * Utility function to create cache keys
 */
export const cacheKeys = {
  dashboardStats: () => "dashboard:stats",
  dashboardCharts: () => "dashboard:charts",
  collection: (col, page = 0) => `collection:${col}:page${page}`,
  collectionCount: (col) => `collection:${col}:count`,
};

/**
 * Pre-defined cache TTLs
 */
export const CACHE_TTL = {
  SHORT: 2 * 60 * 1000,      // 2 minutes - for frequently changing data
  MEDIUM: 5 * 60 * 1000,     // 5 minutes - default
  LONG: 15 * 60 * 1000,      // 15 minutes - for dashboard stats
  SESSION: 30 * 60 * 1000,   // 30 minutes - for session data
};
