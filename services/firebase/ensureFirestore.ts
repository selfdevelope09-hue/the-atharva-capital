import { enableNetwork } from 'firebase/firestore';

import { db, isFirebaseConfigured } from '@/config/firebaseConfig';

let ensured = false;

/**
 * Ensures the Firestore client is allowed to use the network (recover from offline).
 * Safe to call multiple times; runs once per JS context.
 */
export async function ensureFirestoreConnected(): Promise<boolean> {
  if (!isFirebaseConfigured || !db) return false;
  if (ensured) return true;
  try {
    await enableNetwork(db);
    ensured = true;
    if (__DEV__) {
      console.log('[Firestore] Connected (network enabled)');
    }
    return true;
  } catch (e) {
    console.warn('[Firestore] enableNetwork failed', e);
    return false;
  }
}

export function resetFirestoreConnectionFlagForTests(): void {
  ensured = false;
}
