import type { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { STARTING_BALANCES } from '@/constants/appMarkets';
import { db } from '@/config/firebaseConfig';

/**
 * Called after every successful social / phone sign-in.
 * - New user  → creates a full profile document with all 9 market starting balances.
 * - Returning user → merges `lastSeenAt` + any profile fields that may have changed.
 */
export async function createOrUpdateFirestoreUser(user: User): Promise<void> {
  if (!db) return;

  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email ?? null,
      name: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      phone: user.phoneNumber ?? null,
      provider: user.providerData[0]?.providerId ?? 'unknown',
      balances: { ...STARTING_BALANCES },
      positions: [],
      closedPositions: [],
      watchlists: {},
      createdAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    });
  } else {
    await setDoc(
      userRef,
      {
        lastSeenAt: serverTimestamp(),
        ...(user.email && { email: user.email }),
        ...(user.displayName && { name: user.displayName }),
        ...(user.photoURL && { photoURL: user.photoURL }),
        ...(user.phoneNumber && { phone: user.phoneNumber }),
      },
      { merge: true }
    );
  }
}
