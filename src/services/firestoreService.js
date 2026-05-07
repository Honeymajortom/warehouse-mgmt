import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getCountFromServer,
  onSnapshot,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

export { getAuth };

// ── Firebase Config ──────────────────────────────────────
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);

// ═══════════════════════════════════════════════════════════════
// PAGINATED QUERIES (NEW — replaces getAll for large collections)
// ═══════════════════════════════════════════════════════════════

/**
 * Get paginated documents with cursor-based pagination
 * @param {string} col - collection name
 * @param {number} pageSize - items per page (default: 50)
 * @param {DocumentSnapshot|null} lastDoc - cursor for next page
 * @returns {Promise<{docs: Array, lastDoc: DocumentSnapshot|null, hasMore: boolean}>}
 */
export const getPaginated = async (col, pageSize = 50, lastDoc = null) => {
  try {
    let q;
    
    // Try with createdAt ordering
    if (!lastDoc) {
      q = query(
        collection(db, col),
        orderBy("createdAt", "desc"),
        limit(pageSize)
      );
    } else {
      q = query(
        collection(db, col),
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(pageSize)
      );
    }
    
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    
    // If we got results, great
    if (docs.length > 0) {
      return {
        docs,
        lastDoc: snap.docs[snap.docs.length - 1] || null,
        hasMore: snap.docs.length === pageSize,
      };
    }
    
    // If empty, maybe no createdAt field — fallback to unordered
    throw new Error("No results with createdAt");
    
  } catch (e) {
    console.warn(`getPaginated(${col}) createdAt query failed, using fallback:`, e.message);
    
    // Fallback: fetch without ordering (just limit)
    try {
      const q = lastDoc 
        ? query(collection(db, col), startAfter(lastDoc), limit(pageSize))
        : query(collection(db, col), limit(pageSize));
      
      const snap = await getDocs(q);
      return {
        docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        lastDoc: snap.docs[snap.docs.length - 1] || null,
        hasMore: false, // Can't paginate reliably without order
      };
    } catch (fallbackErr) {
      console.error(`getPaginated(${col}) complete failure:`, fallbackErr);
      return { docs: [], lastDoc: null, hasMore: false };
    }
  }
};

/**
 * Get total count (lightweight — doesn't fetch documents)
 */
export const getCount = async (col) => {
  try {
    const snap = await getCountFromServer(collection(db, col));
    return snap.data().count;
  } catch (e) {
    console.error(`getCount(${col})`, e);
    return 0;
  }
};

/**
 * Get first N documents (for small collections or initial load)
 */
export const getRecent = async (col, limitCount = 100) => {
  try {
    const q = query(
      collection(db, col),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    
    if (docs.length > 0) return docs;
    throw new Error("No results");
    
  } catch (e) {
    console.warn(`getRecent(${col}) using fallback`);
    const q = query(collection(db, col), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
};

// ═══════════════════════════════════════════════════════════════
// REAL-TIME SUBSCRIPTION (NEW — for dashboards/small collections)
// ═══════════════════════════════════════════════════════════════

/**
 * Subscribe to real-time updates (use sparingly — large collections = expensive)
 * @returns {Function} unsubscribe function
 */
export const subscribeToCollection = (col, callback, limitCount = 50) => {
  const q = query(
    collection(db, col),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(docs);
  }, (err) => {
    console.error(`subscribeToCollection(${col})`, err);
  });
};

// ═══════════════════════════════════════════════════════════════
// LEGACY FUNCTIONS (kept for compatibility — avoid for large collections)
// ═══════════════════════════════════════════════════════════════

/**
 * ⚠️ WARNING: Fetches ALL documents. Use getPaginated() instead for large collections.
 */
export const getAll = async (col) => {
  try {
    const snap = await getDocs(collection(db, col));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error(`getAll(${col})`, e);
    return [];
  }
};

export const addItem = async (col, data) => {
  try {
    return await addDoc(collection(db, col), {
      ...data,
      createdAt: data.createdAt || new Date().toISOString(),
    });
  } catch (e) {
    console.error(`addItem(${col})`, e);
    throw e;
  }
};

export const deleteItem = async (col, id) => {
  try {
    return await deleteDoc(doc(db, col, id));
  } catch (e) {
    console.error(`deleteItem(${col})`, e);
    throw e;
  }
};

export const updateItem = async (col, id, data) => {
  try {
    return await updateDoc(doc(db, col, id), {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error(`updateItem(${col})`, e);
    throw e;
  }
};

export const searchByField = async (col, field, value) => {
  try {
    const q = query(collection(db, col), where(field, "==", value));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error(`searchByField(${col})`, e);
    return [];
  }
};

// ═══════════════════════════════════════════════════════════════
// ID GENERATORS (unchanged)
// ═══════════════════════════════════════════════════════════════

export const genOrderId = () => {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${date}-${rand}`;
};

export const genPoNumber = () => {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PO-${date}-${rand}`;
};

export const genGrnNumber = () => {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `GRN-${date}-${rand}`;
};

export const genReturnId = () => {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RET-${date}-${rand}`;
};

export const genPvId = () => {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  return `PV-${date}-${Math.floor(1000+Math.random()*9000)}`;
};

export const genTxnId = () => {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  return `TXN-${date}-${Math.floor(1000+Math.random()*9000)}`;
};

export const genQcId = () => {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  return `QC-${date}-${Math.floor(1000+Math.random()*9000)}`;
};

export const genGrnReceivingId = () => {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  return `GRNR-${date}-${Math.floor(1000+Math.random()*9000)}`;
};

// CSV Export (unchanged)
export const exportCSV = (filename, rows) => {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]).filter((k) => k !== "id");
  const header = cols.join(",");
  const body = rows
    .map((r) => cols.map((c) => `"${(r[c] ?? "").toString().replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};