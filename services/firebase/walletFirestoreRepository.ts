/**
 * Optional Firestore mirrors for multi-category wallets:
 *   users/{uid}/wallets/{marketKey}
 * marketKey: crypto | forex | stocks | commodities
 *
 * App balances remain authoritative in Zustand + users/{uid}.balances;
 * this collection is for dashboard / admin reporting when you choose to sync.
 */

import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '@/config/firebaseConfig';

export type WalletCategory = 'crypto' | 'forex' | 'stocks' | 'commodities';

export interface WalletDoc {
  market: WalletCategory;
  currency: string;
  balance: number;
  totalDeposited: number;
  totalProfit: number;
  totalLoss: number;
  updatedAt?: unknown;
}

export function subscribeWallet(
  uid: string,
  category: WalletCategory,
  cb: (w: WalletDoc | null) => void,
): () => void {
  if (!isFirebaseConfigured || !db) {
    cb(null);
    return () => {};
  }
  return onSnapshot(doc(db, 'users', uid, 'wallets', category), (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    cb(snap.data() as WalletDoc);
  }, () => cb(null));
}

export async function upsertWalletSnapshot(uid: string, category: WalletCategory, partial: Partial<WalletDoc>): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  await setDoc(
    doc(db, 'users', uid, 'wallets', category),
    { ...partial, market: category, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function getWalletOnce(uid: string, category: WalletCategory): Promise<WalletDoc | null> {
  if (!isFirebaseConfigured || !db) return null;
  const snap = await getDoc(doc(db, 'users', uid, 'wallets', category));
  if (!snap.exists()) return null;
  return snap.data() as WalletDoc;
}
