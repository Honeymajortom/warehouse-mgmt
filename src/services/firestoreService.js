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

const sanitizeDoc = (d) => {
  const data = d.data();
  const { id: _idDiscard, _id: __idDiscard, docId: _docIdDiscard, ...cleanData } = data;
  return { id: d.id, ...cleanData };
};

// ═══════════════════════════════════════════════════════════════
// OPTIMIZED PAGINATION — requires Firestore indexes on createdAt
// ═══════════════════════════════════════════════════════════════

/**
 * Get paginated documents ordered by createdAt (descending).
 * 
 * REQUIRES:
 * - All documents to have a `createdAt` field
 * - Firestore composite index: collection(createdAt DESC)
 * - Run migrateAllCollections() if you have legacy docs without createdAt
 * 
 * @param {string} col Collection name
 * @param {number} pageSize Documents per page (default 50)
 * @param {DocumentSnapshot} lastDoc Last doc from previous page (for cursor-based pagination)
 * @returns {Promise<{docs, lastDoc, hasMore}>}
 */
export const getPaginated = async (col, pageSize = 50, lastDoc = null) => {
  try {
    const constraints = [orderBy("createdAt", "desc"), limit(pageSize)];
    if (lastDoc) constraints.push(startAfter(lastDoc));

    const q = query(collection(db, col), ...constraints);
    const snap = await getDocs(q);

    // Ordered query returns 0 on first page: documents may lack createdAt.
    // Fall back to unordered so legacy docs are still visible.
    if (snap.docs.length === 0 && !lastDoc) {
      const fallbackSnap = await getDocs(query(collection(db, col), limit(pageSize)));
      if (fallbackSnap.docs.length > 0) {
        console.warn(
          `[getPaginated] ${col}: ordered query returned 0 but ${fallbackSnap.docs.length} docs exist. ` +
          `Run migrateAllCollections() in the browser console to fix permanently.`
        );
        return {
          docs: fallbackSnap.docs.map(sanitizeDoc),
          lastDoc: null,
          hasMore: false,
        };
      }
    }

    return {
      docs: snap.docs.map(sanitizeDoc),
      lastDoc: snap.docs[snap.docs.length - 1] || null,
      hasMore: snap.docs.length === pageSize,
    };
  } catch (error) {
    console.error(`getPaginated(${col}) error:`, error.message);

    if (error.message.includes("FAILED_PRECONDITION")) {
      console.warn(
        `⚠ ${col}: Firestore index missing or migration incomplete.\n` +
        `Run: migrateAllCollections() in the browser console.\n` +
        `Then: firebase deploy --only firestore:indexes`
      );
      // Fall back to unordered fetch
      try {
        const fallbackSnap = await getDocs(query(collection(db, col), limit(pageSize)));
        return {
          docs: fallbackSnap.docs.map(sanitizeDoc),
          lastDoc: null,
          hasMore: false,
        };
      } catch (fallbackErr) {
        console.error(`getPaginated fallback(${col}) error:`, fallbackErr.message);
      }
    }

    return { docs: [], lastDoc: null, hasMore: false };
  }
};

export const getCount = async (col) => {
  try {
    const snap = await getCountFromServer(collection(db, col));
    return snap.data().count;
  } catch (e) {
    console.error(`getCount(${col})`, e);
    return 0;
  }
};

export const getRecent = async (col, limitCount = 100) => {
  try {
    const q = query(collection(db, col), orderBy("createdAt", "desc"), limit(limitCount));
    const snap = await getDocs(q);
    const docs = snap.docs.map(sanitizeDoc);
    if (docs.length > 0) return docs;
    throw new Error("No results");
  } catch (e) {
    console.warn(`getRecent(${col}) fallback — fetching all`);
    const snap = await getDocs(collection(db, col));
    return snap.docs.map(sanitizeDoc);
  }
};

export const subscribeToCollection = (col, callback, limitCount = 50) => {
  const q = query(collection(db, col), orderBy("createdAt", "desc"), limit(limitCount));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(sanitizeDoc));
  }, (err) => {
    console.error(`subscribeToCollection(${col})`, err);
    getDocs(collection(db, col)).then(snap => callback(snap.docs.map(sanitizeDoc)));
  });
};

export const getAll = async (col) => {
  try {
    const snap = await getDocs(collection(db, col));
    return snap.docs.map(sanitizeDoc);
  } catch (e) {
    console.error(`getAll(${col})`, e);
    return [];
  }
};

export const addItem = async (col, data) => {
  try {
    const now = new Date().toISOString();
    return await addDoc(collection(db, col), {
      ...data,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
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
    return snap.docs.map(sanitizeDoc);
  } catch (e) {
    console.error(`searchByField(${col})`, e);
    return [];
  }
};

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

// ═══════════════════════════════════════════════════════════════
// OPTIMIZED AGGREGATIONS — fetch only stats, not full documents
// ═══════════════════════════════════════════════════════════════

/**
 * Get dashboard stats without loading full documents.
 * Fetches only essential data for KPIs (counts, sums, filters).
 * Much faster than getAll() on large collections.
 */
export const getDashboardStats = async () => {
  try {
    // Fetch minimal data for each collection
    const [customers, products, purchases, inventory, grn, returns] = await Promise.all([
      // Customers: just count
      getCount("customers"),
      // Products: just count
      getCount("products"),
      // Purchases: fetch to sum totalCost
      getDocs(collection(db, "purchases")).then(snap => 
        snap.docs.map(d => ({ totalCost: d.data().totalCost || 0 }))
      ),
      // Inventory: fetch to calculate totals and low stock
      getDocs(collection(db, "inventory")).then(snap =>
        snap.docs.map(d => ({
          stockAmount: d.data().stockAmount || 0,
          availableStock: d.data().availableStock || 0
        }))
      ),
      // GRN: fetch to count pending
      getDocs(collection(db, "grn")).then(snap =>
        snap.docs.map(d => ({ putAwayStatus: d.data().putAwayStatus }))
      ),
      // Returns: just count
      getCount("returns")
    ]);

    // Calculate aggregates
    const totalCost = purchases.reduce((s, r) => s + Number(r.totalCost || 0), 0);
    const totalStock = inventory.reduce((s, r) => s + Number(r.stockAmount || 0), 0);
    const lowStock = inventory.filter(i => Number(i.availableStock || 0) < 20).length;
    const pendingGrn = grn.filter(g => g.putAwayStatus !== "Done").length;

    return {
      customerCount: customers,
      productCount: products,
      totalCost,
      totalStock,
      lowStock,
      pendingGrn,
      returnCount: returns
    };
  } catch (error) {
    console.error("getDashboardStats() error:", error);
    return {
      customerCount: 0,
      productCount: 0,
      totalCost: 0,
      totalStock: 0,
      lowStock: 0,
      pendingGrn: 0,
      returnCount: 0
    };
  }
};

/**
 * Alternative: More aggressive optimization using only counts.
 * For very large collections, fetch only counts (fastest).
 * Trade-off: can't compute low stock count without fetching inventory.
 */
export const getDashboardStatsFast = async () => {
  try {
    const [
      customerCount,
      productCount,
      returnCount
    ] = await Promise.all([
      getCount("customers"),
      getCount("products"),
      getCount("returns")
    ]);

    // These still need fetches for calculations
    const purchases = await getDocs(collection(db, "purchases"));
    const inventory = await getDocs(collection(db, "inventory"));
    const grnDocs = await getDocs(collection(db, "grn"));

    const totalCost = purchases.docs.reduce((s, d) => s + Number(d.data().totalCost || 0), 0);
    const totalStock = inventory.docs.reduce((s, d) => s + Number(d.data().stockAmount || 0), 0);
    const lowStock = inventory.docs.filter(d => Number(d.data().availableStock || 0) < 20).length;
    const pendingGrn = grnDocs.docs.filter(d => d.data().putAwayStatus !== "Done").length;

    return {
      customerCount,
      productCount,
      totalCost,
      totalStock,
      lowStock,
      pendingGrn,
      returnCount
    };
  } catch (error) {
    console.error("getDashboardStatsFast() error:", error);
    return {
      customerCount: 0,
      productCount: 0,
      totalCost: 0,
      totalStock: 0,
      lowStock: 0,
      pendingGrn: 0,
      returnCount: 0
    };
  }
};

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