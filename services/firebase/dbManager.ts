import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { auth, db, isFirebaseConfigured } from '@/config/firebaseConfig';

function requireUid(): string {
  const uid = auth?.currentUser?.uid;
  if (!uid) {
    throw new Error('[dbManager] No signed-in user. Wait for anonymous auth boot.');
  }
  return uid;
}

function requireDb() {
  if (!isFirebaseConfigured || !db) {
    throw new Error('[dbManager] Firestore is not configured — check config/firebaseConfig.ts');
  }
  return db;
}

/**
 * Persists a trade under `users/{uid}/trades` (auto-generated document id).
 * Merges server timestamps for ordering / sync diagnostics.
 */
export async function saveTradeToCloud(tradeData: Record<string, unknown>): Promise<string> {
  const firestore = requireDb();
  const uid = requireUid();
  const colRef = collection(firestore, 'users', uid, 'trades');
  const docRef = await addDoc(colRef, {
    ...tradeData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Updates `totalNetWorth` on the root `users/{uid}` profile (merge) for leaderboard-style sync.
 */
export async function syncWalletToCloud(netWorth: number): Promise<void> {
  const firestore = requireDb();
  const uid = requireUid();
  const userRef = doc(firestore, 'users', uid);
  await setDoc(
    userRef,
    {
      totalNetWorth: netWorth,
      walletSyncedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
