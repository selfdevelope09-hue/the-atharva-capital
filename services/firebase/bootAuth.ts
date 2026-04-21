import { signInAnonymously } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { auth, db, isFirebaseConfigured } from '@/config/firebaseConfig';
import { generateAtcClientId } from '@/lib/clientId';

/** e.g. Trader_99X — two digits + trailing letter */
export function generateCoolTraderUsername(): string {
  const n = Math.floor(10 + Math.random() * 90);
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return `Trader_${n}${letter}`;
}

/**
 * Boot sequence: if a real (non-anonymous) user is already signed in just refresh their
 * `lastSeenAt`. Otherwise sign in anonymously so Firestore rules have a uid to work with —
 * the user will be prompted to log in via the login screen.
 *
 * IMPORTANT: `auth.authStateReady()` waits for Firebase to finish restoring the persisted
 * auth session from localStorage/IndexedDB before we ever inspect `auth.currentUser`.
 * Without this wait, `currentUser` is always null on first render (state not yet hydrated)
 * and `signInAnonymously()` would clobber a real already-logged-in session.
 */
export async function bootFirebaseAuthAndProfile(): Promise<void> {
  if (!isFirebaseConfigured || !auth || !db) {
    if (__DEV__) {
      console.warn('[Firebase] Missing EXPO_PUBLIC_FIREBASE_* env; skipping anonymous auth.');
    }
    return;
  }

  // Wait for Firebase to finish restoring the persisted auth state from storage.
  // This is the critical fix: without it, auth.currentUser is null on cold start
  // even when a real user is already logged in.
  await auth.authStateReady();

  // If a real account is already persisted, don't sign them out with signInAnonymously.
  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    const uid = auth.currentUser.uid;
    await setDoc(doc(db, 'users', uid), { lastSeenAt: serverTimestamp() }, { merge: true });
    return;
  }

  const credential = await signInAnonymously(auth);
  const uid = credential.user.uid;
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      uid,
      clientId: generateAtcClientId(),
      username: generateCoolTraderUsername(),
      totalNetWorth: 0,
      createdAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    });
  } else {
    await setDoc(
      userRef,
      {
        lastSeenAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}
