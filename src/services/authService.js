import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

// Import the already-initialised app and db from firestoreService
// so we share the same Firebase app instance
import { db } from "./firestoreService";
import { getApps } from "firebase/app";

// Get auth from the already-initialised app (avoids "no-app" error)
const firebaseApp = getApps()[0];
export const auth = getAuth(firebaseApp);

// ── Register a new admin ──────────────────────────────────────
export const registerAdmin = async ({ name, email, password }) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await setDoc(doc(db, "admins", cred.user.uid), {
    uid:       cred.user.uid,
    name,
    email,
    role:      "admin",
    createdAt: new Date().toISOString(),
  });
  return cred.user;
};

// ── Sign in ───────────────────────────────────────────────────
export const loginAdmin = async ({ email, password }) => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db, "admins", cred.user.uid));
  if (!snap.exists()) {
    await signOut(auth);
    throw new Error("Account not found in admin registry.");
  }
  return cred.user;
};

// ── Sign out ──────────────────────────────────────────────────
export const logoutAdmin = () => signOut(auth);

// ── Auth state observer ───────────────────────────────────────
export const onAuth = (cb) => onAuthStateChanged(auth, cb);

// ── Audit helper — call this before any addItem/updateItem ────
export const getAuditFields = () => {
  const user = auth.currentUser;
  return {
    createdBy:    user?.displayName || user?.email || "Unknown",
    createdByUid: user?.uid         || "",
    timestamp:    new Date().toISOString(),
  };
};
