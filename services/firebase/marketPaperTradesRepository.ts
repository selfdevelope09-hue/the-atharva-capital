/**
 * Paper-trading orders stored in top-level `trades` (Firestore).
 * Requires rules allowing authenticated users to create/read their own docs.
 */

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { auth, db, isFirebaseConfigured } from '@/config/firebaseConfig';

export const TRADES_COLLECTION = 'trades';

export type PaperTradeSide = 'BUY' | 'SELL';
export type PaperOrderType = 'market' | 'limit' | 'stop';
export type PaperTradeStatus = 'open' | 'closed';

export type PaperTradeDoc = {
  uid: string;
  market: string;
  symbol: string;
  pollKey: string;
  side: PaperTradeSide;
  orderType: PaperOrderType;
  price: number;
  units: number;
  takeProfit: number | null;
  stopLoss: number | null;
  leverage: number;
  status: PaperTradeStatus;
  openedAt: Timestamp;
  closedAt?: Timestamp | null;
  closePrice?: number | null;
  pnl?: number | null;
};

export async function placePaperTrade(input: {
  market: string;
  symbol: string;
  pollKey: string;
  side: PaperTradeSide;
  orderType: PaperOrderType;
  price: number;
  units: number;
  takeProfit: number | null;
  stopLoss: number | null;
  leverage: number;
}): Promise<string | null> {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) return null;
  const uid = auth.currentUser.uid;
  const ref = await addDoc(collection(db, TRADES_COLLECTION), {
    uid,
    market: input.market,
    symbol: input.symbol,
    pollKey: input.pollKey,
    side: input.side,
    orderType: input.orderType,
    price: input.price,
    units: input.units,
    takeProfit: input.takeProfit,
    stopLoss: input.stopLoss,
    leverage: input.leverage,
    status: 'open' as const,
    openedAt: serverTimestamp(),
    pnl: 0,
  });
  return ref.id;
}

/**
 * Single-field friendly query: uid + orderBy(openedAt).
 * Filters market + status client-side to avoid composite index requirements.
 */
export function subscribeOpenPaperTrades(
  market: string,
  onData: (rows: (PaperTradeDoc & { id: string })[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) {
    onData([]);
    return () => {};
  }
  const uid = auth.currentUser.uid;
  const q = query(collection(db, TRADES_COLLECTION), where('uid', '==', uid), orderBy('openedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as PaperTradeDoc) }))
        .filter((r) => r.market === market && r.status === 'open');
      onData(rows);
    },
    (e) => {
      onError?.(e as Error);
      onData([]);
    },
  );
}

export function subscribeClosedPaperTrades(
  market: string,
  limitN: number,
  onData: (rows: (PaperTradeDoc & { id: string })[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) {
    onData([]);
    return () => {};
  }
  const uid = auth.currentUser.uid;
  const q = query(collection(db, TRADES_COLLECTION), where('uid', '==', uid), orderBy('openedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as PaperTradeDoc) }))
        .filter((r) => r.market === market && r.status === 'closed')
        .sort((a, b) => (b.closedAt?.toMillis?.() ?? 0) - (a.closedAt?.toMillis?.() ?? 0))
        .slice(0, limitN);
      onData(rows);
    },
    (e) => {
      onError?.(e as Error);
      onData([]);
    },
  );
}

export async function closePaperTrade(
  tradeId: string,
  closePrice: number,
  pnl: number,
): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const r = doc(db, TRADES_COLLECTION, tradeId);
  await updateDoc(r, {
    status: 'closed',
    closedAt: serverTimestamp(),
    closePrice,
    pnl,
  });
}
