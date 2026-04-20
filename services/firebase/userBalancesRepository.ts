/**
 * Balance reads/writes with `runTransaction` for any ledger mutation.
 * Merges into `users/{uid}` — balances object shaped as `UserBalances`.
 */

import { doc, getDoc, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore';

import type { AppMarket } from '@/constants/appMarkets';
import { STARTING_BALANCES } from '@/constants/appMarkets';
import { auth, db, isFirebaseConfigured } from '@/config/firebaseConfig';
import type { UserBalances } from '@/types/firestoreUser';

function requireDb(): Firestore {
  if (!isFirebaseConfigured || !db) throw new Error('[balances] Firestore not configured');
  return db;
}

function uid(): string {
  const u = auth?.currentUser?.uid;
  if (!u) throw new Error('[balances] Not signed in');
  return u;
}

function defaultBalances(): UserBalances {
  return { ...STARTING_BALANCES };
}

function mergeBalances(raw: unknown): UserBalances {
  const d = defaultBalances();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Record<string, number>;
  for (const k of Object.keys(d) as AppMarket[]) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) d[k] = v;
  }
  return d;
}

export async function loadBalancesFromCloud(): Promise<UserBalances | null> {
  if (!isFirebaseConfigured || !db) return null;
  const snap = await getDoc(doc(requireDb(), 'users', uid()));
  if (!snap.exists()) return null;
  const data = snap.data();
  return mergeBalances(data?.balances);
}

type TxFn = (balances: UserBalances) => UserBalances;

/**
 * Atomically read/modify/write balances. Always uses full `balances` object merge.
 */
export async function runBalanceTransaction(apply: TxFn): Promise<UserBalances> {
  const firestore = requireDb();
  const id = uid();
  const ref = doc(firestore, 'users', id);
  let nextSnapshot: UserBalances = defaultBalances();

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists() ? mergeBalances(snap.data()?.balances) : defaultBalances();
    nextSnapshot = apply({ ...prev });
    tx.set(
      ref,
      {
        balances: nextSnapshot,
        balanceUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  return nextSnapshot;
}

/** Signed delta in **that market’s currency** (not USD). */
export async function applyBalanceDelta(market: AppMarket, delta: number): Promise<UserBalances> {
  return runBalanceTransaction((b) => {
    const next = { ...b };
    const v = (next[market] ?? 0) + delta;
    next[market] = Math.max(0, v);
    return next;
  });
}

/** Overwrite one market balance (e.g. reset). */
export async function setMarketBalance(market: AppMarket, value: number): Promise<UserBalances> {
  return runBalanceTransaction((b) => {
    const next = { ...b };
    next[market] = Math.max(0, value);
    return next;
  });
}
