import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, collection, getDocs, addDoc,
  deleteDoc, doc, updateDoc, query, where, orderBy,
} from "firebase/firestore";
// Auth is initialised here so it shares the same app instance
import { getAuth } from "firebase/auth";
export { getAuth };   // re-export so authService can grab it without re-initialising

// ── Paste your Firebase config here ──────────────────────
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};
// ─────────────────────────────────────────────────────────

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);

export const getAll = async (col) => {
  try {
    const snap = await getDocs(collection(db, col));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error(`getAll(${col})`, e); return []; }
};

export const addItem = async (col, data) => {
  try { return await addDoc(collection(db, col), data); }
  catch (e) { console.error(`addItem(${col})`, e); }
};

export const deleteItem = async (col, id) => {
  try { return await deleteDoc(doc(db, col, id)); }
  catch (e) { console.error(`deleteItem(${col})`, e); }
};

export const updateItem = async (col, id, data) => {
  try { return await updateDoc(doc(db, col, id), data); }
  catch (e) { console.error(`updateItem(${col})`, e); }
};

export const searchByField = async (col, field, value) => {
  try {
    const q = query(collection(db, col), where(field, "==", value));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error(`searchByField(${col})`, e); return []; }
};

// Generate readable IDs
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

// CSV Export helper
export const exportCSV = (filename, rows) => {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]).filter((k) => k !== "id");
  const header = cols.join(",");
  const body = rows.map((r) => cols.map((c) => `"${(r[c] ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
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
