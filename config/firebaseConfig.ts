import { getAnalytics } from 'firebase/analytics';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// ─── Firebase project: atharva-capital-v2 ────────────────────────────────────
// Console: https://console.firebase.google.com/project/atharva-capital-v2
// Auth providers enabled: Google, Facebook, Phone/SMS, Email/Password
// Firestore rules: users/{uid} — read/write if request.auth.uid == uid
const firebaseConfig = {
  apiKey: 'AIzaSyD7fVrGnEirI1DRO6LYQbx0FMSaOLsaeRE',
  authDomain: 'atharva-capital-v2.firebaseapp.com',
  projectId: 'atharva-capital-v2',
  storageBucket: 'atharva-capital-v2.firebasestorage.app',
  messagingSenderId: '972959568775',
  appId: '1:972959568775:web:211853108cd11bc432b922',
  measurementId: 'G-5KCC5QM8YG',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
/** Shared Firestore — enable network via `ensureFirestoreConnected` (FirestoreProvider + bootAuth). */
export const db = getFirestore(app);

/** Firebase Storage — used for profile photo uploads */
export const storage = getStorage(app);

/**
 * Analytics is web-only (no native Firebase Analytics SDK bundled here).
 * Guard against SSR / server environments where `window` is undefined.
 */
export const analytics =
  typeof window !== 'undefined' ? getAnalytics(app) : null;

/**
 * Always true — config is hardcoded, no env-var check needed.
 * Kept for backwards-compat with guards in service files.
 */
export const isFirebaseConfigured = true as const;

export const firebaseApp = app;
export default app;
