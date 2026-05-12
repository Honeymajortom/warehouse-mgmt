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
// SMART PAGINATION — handles partial createdAt migration
// ═══════════════════════════════════════════════════════════════

/**
 * Get paginated documents.
 * If createdAt is missing on some docs, fetches ALL docs to avoid hiding data.
 */
export const getPaginated = async (col, pageSize = 50, lastDoc = null) => {
  // If we're paginating (lastDoc exists), try createdAt ordering
  if (lastDoc) {
    try {
      const q = query(
        collection(db, col),
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(pageSize)
      );
      const snap = await getDocs(q);
      return {
        docs: snap.docs.map(sanitizeDoc),
        lastDoc: snap.docs[snap.docs.length - 1] || null,
        hasMore: snap.docs.length === pageSize,
      };
    } catch (e) {
      console.warn(`getPaginated(${col}) pagination failed:`, e.message);
      return { docs: [], lastDoc: null, hasMore: false };
    }
  }

  // First page: check if collection has createdAt uniformly
  try {
    // Try ordering by createdAt
    const q = query(collection(db, col), orderBy("createdAt", "desc"), limit(pageSize));
    const snap = await getDocs(q);
    const docs = snap.docs.map(sanitizeDoc);

    // If we got results, check if this is the FULL collection
    // by comparing with total count
    const totalSnap = await getCountFromServer(collection(db, col));
    const totalCount = totalSnap.data().count;

    if (docs.length === totalCount) {
      // All docs have createdAt — return as-is
      return { docs, lastDoc: null, hasMore: false };
    }

    // Partial migration: some docs have createdAt, some don't
    // Fetch ALL docs to avoid hiding unmigrated data
    console.warn(
      `getPaginated(${col}) partial migration detected: ` +
      `${docs.length} docs have createdAt out of ${totalCount} total. ` +
      `Fetching ALL docs to avoid hiding data.`
    );
    throw new Error("Partial migration — fetch all");

  } catch (e) {
    // Fallback: fetch ALL documents
    try {
      const snap = await getDocs(collection(db, col));
      return {
        docs: snap.docs.map(sanitizeDoc),
        lastDoc: null,
        hasMore: false,
      };
    } catch (fallbackErr) {
      console.error(`getPaginated(${col}) complete failure:`, fallbackErr);
      return { docs: [], lastDoc: null, hasMore: false };
    }
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