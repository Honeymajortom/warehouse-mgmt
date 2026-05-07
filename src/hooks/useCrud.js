import { useState, useEffect, useCallback, useRef } from "react";
import {
  getPaginated,
  getCount,
  addItem,
  deleteItem,
  updateItem,
  subscribeToCollection,
} from "../services/firestoreService";

const DEFAULT_PAGE_SIZE = 50;

export default function useCrud(collectionName, options = {}) {
  const { pageSize = DEFAULT_PAGE_SIZE, realtime = false } = options;
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  const lastDocRef = useRef(null);

  // Fetch data whenever collectionName changes
  const refresh = useCallback(async (reset = true) => {
    if (reset) {
      setLoading(true);
      lastDocRef.current = null;
      setItems([]); // Clear old items immediately
    }
    
    try {
      const { docs, lastDoc, hasMore: more } = await getPaginated(
        collectionName,
        pageSize,
        reset ? null : lastDocRef.current
      );
      
      lastDocRef.current = lastDoc;
      setHasMore(more);
      
      if (reset) {
        setItems(docs);
        // Get total count on initial load
        try {
          const count = await getCount(collectionName);
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
  }, [collectionName, pageSize]);

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
      return docRef;
    } catch (err) {
      console.error("Add error:", err);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [collectionName]);

  // Optimistic delete
  const remove = useCallback(async (id) => {
    try {
      await deleteItem(collectionName, id);
      setItems(prev => prev.filter(item => item.id !== id));
      setTotalCount(prev => prev - 1);
    } catch (err) {
      console.error("Delete error:", err);
      throw err;
    }
  }, [collectionName]);

  // Optimistic update
  const update = useCallback(async (id, data) => {
    setSaving(true);
    try {
      await updateItem(collectionName, id, data);
      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, ...data } : item
      ));
    } catch (err) {
      console.error("Update error:", err);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [collectionName]);

  return { 
    items, 
    loading, 
    saving, 
    totalCount,
    hasMore,
    refresh,
    loadMore,
    add, 
    remove, 
    update 
  };
}