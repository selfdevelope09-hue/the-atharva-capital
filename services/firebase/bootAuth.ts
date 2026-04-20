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
 * Silent anonymous sign-in + first-run Firestore profile (`users/{uid}`).
 * Safe to call once after fonts / shell are ready.
 */
export async function bootFirebaseAuthAndProfile(): Promise<void> {
  if (!isFirebaseConfigured || !auth || !db) {
    if (__DEV__) {
      console.warn('[Firebase] Missing EXPO_PUBLIC_FIREBASE_* env; skipping anonymous auth.');
    }
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
