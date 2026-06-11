import { useState, useEffect, useCallback, useRef } from "react";
import {
  getPaginated,
  getCount,
  addItem,
  deleteItem,
  updateItem,
  subscribeToCollection,
} from "../services/firestoreService";
import { cacheManager, cacheKeys, CACHE_TTL } from "../services/cacheManager";

const DEFAULT_PAGE_SIZE = 50;

export default function useCrud(collectionName, options = {}) {
  const { pageSize = DEFAULT_PAGE_SIZE, realtime = false, useCache = true } = options;
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [cacheHit, setCacheHit] = useState(false);
  
  const lastDocRef = useRef(null);

  // Fetch data whenever collectionName changes
  const refresh = useCallback(async (reset = true) => {
    if (reset) {
      setLoading(true);
      lastDocRef.current = null;
      setItems([]);
      setCacheHit(false);
    }
    
    try {
      const cacheKey = cacheKeys.collection(collectionName, 0);

      let docs, lastDoc, more;
      if (reset && useCache) {
        // Cache read is best-effort — a broken/closed IndexedDB must not block the Firestore fetch
        let cached = null;
        try {
          cached = await cacheManager.get(cacheKey);
        } catch (cacheErr) {
          console.warn(`[useCrud] cache read failed (${collectionName}):`, cacheErr.message);
        }

        if (cached) {
          ({ docs, lastDoc, more } = cached);
          setCacheHit(true);
        } else {
          const result = await getPaginated(collectionName, pageSize, null);
          ({ docs, lastDoc: lastDoc, hasMore: more } = result);
          // Only cache non-empty results — never cache a failed/empty fetch
          if (docs.length > 0) {
            try {
              await cacheManager.set(cacheKey, { docs, lastDoc, more }, CACHE_TTL.MEDIUM);
            } catch (cacheErr) {
              console.warn(`[useCrud] cache write failed (${collectionName}):`, cacheErr.message);
            }
          }
        }
      } else {
        const result = await getPaginated(
          collectionName,
          pageSize,
          reset ? null : lastDocRef.current
        );
        ({ docs, lastDoc: lastDoc, hasMore: more } = result);
      }

      lastDocRef.current = lastDoc;
      setHasMore(more);

      if (reset) {
        setItems(docs);
        // Get total count on initial load
        try {
          const countCacheKey = cacheKeys.collectionCount(collectionName);
          let cachedCount = null;
          if (useCache) {
            try { cachedCount = await cacheManager.get(countCacheKey); } catch (_) {}
          }

          let count;
          if (cachedCount) {
            count = cachedCount;
          } else {
            count = await getCount(collectionName);
            if (useCache && count > 0) {
              try {
                await cacheManager.set(countCacheKey, count, CACHE_TTL.LONG);
              } catch (_) {}
            }
          }
          setTotalCount(count);
        } catch (countErr) {
          console.warn("getCount failed:", countErr);
          setTotalCount(docs.length);
        }
      } else {
        setItems(prev => [...prev, ...docs]);
      }
    } catch (err) {
      console.error(`useCrud error (${collectionName}):`, err);
      setItems([]);
      setTotalCount(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [collectionName, pageSize, useCache]);

  // ALWAYS fetch on mount and when collection changes
  useEffect(() => {
    refresh(true);
  }, [collectionName, refresh]);

  // Real-time mode (optional override)
  useEffect(() => {
    if (!realtime) return;
    
    const unsub = subscribeToCollection(collectionName, (docs) => {
      setItems(docs);
      setTotalCount(docs.length);
      setHasMore(false);
      setLoading(false);
    }, pageSize);
    
    return () => unsub();
  }, [collectionName, realtime, pageSize]);

  // Load more
  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    await refresh(false);
  }, [refresh, hasMore, loading]);

  // Optimistic add
  const add = useCallback(async (data) => {
    setSaving(true);
    try {
      const docRef = await addItem(collectionName, data);
      const newItem = { id: docRef.id, ...data };
      setItems(prev => [newItem, ...prev]);
      setTotalCount(prev => prev + 1);
      
      // Invalidate collection cache
      if (useCache) {
        await Promise.all([
          cacheManager.invalidate(`collection:${collectionName}`),
          cacheManager.invalidate(`purchase:${collectionName}`),
        ]);
      }

      return docRef;
    } catch (err) {
      console.error("Add error:", err);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [collectionName, useCache]);

  // Optimistic delete
  const remove = useCallback(async (id) => {
    try {
      await deleteItem(collectionName, id);
      setItems(prev => prev.filter(item => item.id !== id));
      setTotalCount(prev => prev - 1);

      // Invalidate collection cache
      if (useCache) {
        await Promise.all([
          cacheManager.invalidate(`collection:${collectionName}`),
          cacheManager.invalidate(`purchase:${collectionName}`),
        ]);
      }
    } catch (err) {
      console.error("Delete error:", err);
      throw err;
    }
  }, [collectionName, useCache]);

  // Optimistic update
  const update = useCallback(async (id, data) => {
    setSaving(true);
    try {
      await updateItem(collectionName, id, data);
      setItems(prev => prev.map(item =>
        item.id === id ? { ...item, ...data } : item
      ));

      // Invalidate collection cache
      if (useCache) {
        await Promise.all([
          cacheManager.invalidate(`collection:${collectionName}`),
          cacheManager.invalidate(`purchase:${collectionName}`),
        ]);
      }
    } catch (err) {
      console.error("Update error:", err);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [collectionName, useCache]);

  return { 
    items, 
    loading, 
    saving, 
    totalCount,
    hasMore,
    cacheHit,
    refresh,
    loadMore,
    add, 
    remove, 
    update 
  };
}