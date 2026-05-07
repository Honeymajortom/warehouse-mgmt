import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { db } from "./firestoreService";
import { getApps } from "firebase/app";

const firebaseApp = getApps()[0];
export const auth = getAuth(firebaseApp);

const ADMINS_COL = "admins";
const USERS_COL = "users";

// ═══════════════════════════════════════════════════════════════
// AUTH FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Login — checks both admins and users collections
 * Returns full user object with role, status, permissions
 */
export const loginUser = async ({ email, password }) => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  // Try admins first
  let snap = await getDoc(doc(db, ADMINS_COL, uid));
  let source = ADMINS_COL;

  // Fall back to users collection
  if (!snap.exists()) {
    snap = await getDoc(doc(db, USERS_COL, uid));
    source = USERS_COL;
  }

  if (!snap.exists()) {
    await signOut(auth);
    throw new Error("Account not found in registry.");
  }

  const userData = snap.data();

  // Update last login
  await updateDoc(doc(db, source, uid), {
    lastLogin: new Date().toISOString(),
    activity: [
      ...(userData.activity || []),
      { action: "Logged in", timestamp: new Date().toISOString() },
    ],
  });

  return {
    id: uid,
    ...userData,
    source,
  };
};

/**
 * Register as Operator or Viewer (goes to pending approval)
 */
export const requestAccess = async ({ name, email, password, role }) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });

  await setDoc(doc(db, USERS_COL, cred.user.uid), {
    uid: cred.user.uid,
    name,
    email,
    role,
    status: "pending",
    permissions: [],
    requestedAt: new Date().toISOString(),
    approvedAt: null,
    approvedBy: null,
    activity: [{ action: "Registration submitted", timestamp: new Date().toISOString() }],
  });

  return { success: true, message: "Request submitted. Waiting for admin approval." };
};

/**
 * Register as Admin (immediate approval)
 */
export const registerAdmin = async ({ name, email, password }) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });

  await setDoc(doc(db, ADMINS_COL, cred.user.uid), {
    uid: cred.user.uid,
    name,
    email,
    role: "admin",
    status: "approved",
    permissions: ["*"],
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    activity: [{ action: "Account created", timestamp: new Date().toISOString() }],
  });

  return cred.user;
};

/**
 * Logout
 */
export const logoutAdmin = () => signOut(auth);

/**
 * Auth state listener
 */
export const onAuth = (cb) => onAuthStateChanged(auth, cb);

/**
 * Get full user profile from Firestore
 */
export const getUserProfile = async (uid) => {
  let snap = await getDoc(doc(db, ADMINS_COL, uid));
  if (snap.exists()) return { id: uid, ...snap.data(), source: ADMINS_COL };

  snap = await getDoc(doc(db, USERS_COL, uid));
  if (snap.exists()) return { id: uid, ...snap.data(), source: USERS_COL };

  return null;
};

// ═══════════════════════════════════════════════════════════════
// ADMIN FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get all users (admins + users)
 */
export const getAllUsers = async () => {
  const users = [];
  const adminSnap = await getDocs(collection(db, ADMINS_COL));
  adminSnap.forEach((d) => users.push({ id: d.id, ...d.data(), source: ADMINS_COL }));

  const userSnap = await getDocs(collection(db, USERS_COL));
  userSnap.forEach((d) => users.push({ id: d.id, ...d.data(), source: USERS_COL }));

  return users;
};

/**
 * Approve pending user
 */
export const approveUser = async (uid, adminUid) => {
  const ref = doc(db, USERS_COL, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("User not found");

  const userData = snap.data();
  const defaultPerms = getDefaultPermissions(userData.role);

  await updateDoc(ref, {
    status: "approved",
    approvedAt: new Date().toISOString(),
    approvedBy: adminUid,
    permissions: defaultPerms,
    activity: [
      ...(userData.activity || []),
      { action: "Account approved by admin", timestamp: new Date().toISOString() },
    ],
  });

  return true;
};

/**
 * Reject pending user
 */
export const rejectUser = async (uid, adminUid) => {
  const ref = doc(db, USERS_COL, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("User not found");

  const userData = snap.data();

  await updateDoc(ref, {
    status: "rejected",
    rejectedAt: new Date().toISOString(),
    rejectedBy: adminUid,
    activity: [
      ...(userData.activity || []),
      { action: "Account rejected by admin", timestamp: new Date().toISOString() },
    ],
  });

  return true;
};

/**
 * Update user (role, status, name, etc.)
 */
export const updateUser = async (uid, updates, source = USERS_COL) => {
  const ref = doc(db, source, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("User not found");

  const userData = snap.data();
  let activity = userData.activity || [];

  if (updates.status && updates.status !== userData.status) {
    activity = [...activity, { action: `Status changed to ${updates.status}`, timestamp: new Date().toISOString() }];
  }
  if (updates.role && updates.role !== userData.role) {
    activity = [...activity, { action: `Role changed to ${updates.role}`, timestamp: new Date().toISOString() }];
  }

  await updateDoc(ref, {
    ...updates,
    updatedAt: new Date().toISOString(),
    activity,
  });

  return true;
};

/**
 * Update permissions directly
 */
export const updateUserPermissions = async (uid, permissions) => {
  const ref = doc(db, USERS_COL, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("User not found");

  const userData = snap.data();

  await updateDoc(ref, {
    permissions,
    updatedAt: new Date().toISOString(),
    activity: [
      ...(userData.activity || []),
      { action: "Permissions updated by admin", timestamp: new Date().toISOString() },
    ],
  });

  return true;
};

/**
 * Admin: Delete a user (from Firestore + Firebase Auth)
 */
export const deleteUser = async (uid) => {
  // Delete from Firestore
  const userRef = doc(db, USERS_COL, uid);
  const adminRef = doc(db, ADMINS_COL, uid);
  
  const userSnap = await getDoc(userRef);
  const adminSnap = await getDoc(adminRef);
  
  if (!userSnap.exists() && !adminSnap.exists()) {
    throw new Error("User not found");
  }
  
  // Delete from Firestore
  if (userSnap.exists()) await deleteDoc(userRef);
  if (adminSnap.exists()) await deleteDoc(adminRef);
  
  return true;
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

const getDefaultPermissions = (role) => {
  const defaults = {
    operator: [
      "dashboard:view",
      "customers:view", "customers:create", "customers:edit",
      "vendors:view", "vendors:create", "vendors:edit",
      "products:view", "products:create", "products:edit",
      "purchase:view", "purchase:create", "purchase:edit",
      "grn:view", "grn:create", "grn:execute",
      "putaway:view", "putaway:execute",
      "inventory:view", "inventory:edit",
      "picking:view", "picking:execute",
      "packing:view", "packing:execute",
      "returns:view", "returns:execute",
      "reports:view",
    ],
    viewer: [
      "dashboard:view",
      "customers:view",
      "vendors:view",
      "products:view",
      "purchase:view",
      "grn:view",
      "putaway:view",
      "inventory:view",
      "picking:view",
      "packing:view",
      "returns:view",
      "reports:view",
    ],
  };
  return defaults[role] || [];
};

/**
 * Audit helper for tracking who created/updated records
 */
export const getAuditFields = () => {
  const user = auth.currentUser;
  return {
    createdBy: user?.displayName || user?.email || "Unknown",
    createdByUid: user?.uid || "",
    timestamp: new Date().toISOString(),
  };
};