/**
 * Price alerts: `users/{uid}/alerts/{alertId}` (merge-friendly docs).
 */

import { collection, deleteDoc, doc, getDocs, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

import type { AppMarket } from '@/constants/appMarkets';
import { auth, db, isFirebaseConfigured } from '@/config/firebaseConfig';
import { FS } from '@/services/firebase/paths';

export type AlertDoc = {
  id: string;
  market: AppMarket;
  symbol: string;
  /** Full Yahoo / Binance symbol used with unified ticks */
  symbolFull: string;
  condition: 'above' | 'below';
  price: number;
  /** once | every | daily */
  alertType: 'once' | 'every' | 'daily';
  active: boolean;
  createdAt: string;
  triggeredAt?: string;
  triggerCount: number;
};

function col(uid: string) {
  if (!db) throw new Error('[alerts] No db');
  return collection(db, FS.users, uid, FS.alerts);
}

export function subscribeAlerts(uid: string, cb: (rows: AlertDoc[]) => void): () => void {
  if (!isFirebaseConfigured || !db) {
    cb([]);
    return () => {};
  }
  return onSnapshot(col(uid), (snap) => {
    const out: AlertDoc[] = [];
    snap.forEach((d) => {
      const x = d.data() as Record<string, unknown>;
      out.push({
        id: d.id,
        market: x.market as AppMarket,
        symbol: String(x.symbol ?? ''),
        symbolFull: String(x.symbolFull ?? x.symbol ?? ''),
        condition: (x.condition === 'below' ? 'below' : 'above') as 'above' | 'below',
        price: typeof x.price === 'number' ? x.price : 0,
        alertType: (x.alertType as AlertDoc['alertType']) ?? 'once',
        active: x.active !== false,
        createdAt: typeof x.createdAt === 'string' ? x.createdAt : new Date().toISOString(),
        triggeredAt: typeof x.triggeredAt === 'string' ? x.triggeredAt : undefined,
        triggerCount: typeof x.triggerCount === 'number' ? x.triggerCount : 0,
      });
    });
    out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    cb(out);
  });
}

export async function saveAlert(uid: string, input: Omit<AlertDoc, 'id' | 'triggerCount' | 'triggeredAt'> & { id?: string }): Promise<string> {
  if (!isFirebaseConfigured || !db) throw new Error('[alerts] Offline');
  const id = input.id ?? `al_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const createdAt = input.createdAt ?? new Date().toISOString();
  await setDoc(doc(col(uid), id), {
    market: input.market,
    symbol: input.symbol,
    symbolFull: input.symbolFull,
    condition: input.condition,
    price: input.price,
    alertType: input.alertType,
    active: input.active,
    createdAt,
    id,
    triggerCount: 0,
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function updateAlert(uid: string, id: string, patch: Partial<AlertDoc>): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('[alerts] Offline');
  await setDoc(doc(col(uid), id), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}

export async function deleteAlert(uid: string, id: string): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('[alerts] Offline');
  await deleteDoc(doc(col(uid), id));
}

export async function loadAlertsOnce(uid: string): Promise<AlertDoc[]> {
  if (!isFirebaseConfigured || !db) return [];
  const snap = await getDocs(col(uid));
  const out: AlertDoc[] = [];
  snap.forEach((d) => {
    const x = d.data() as Record<string, unknown>;
    out.push({
      id: d.id,
      market: x.market as AppMarket,
      symbol: String(x.symbol ?? ''),
      symbolFull: String(x.symbolFull ?? x.symbol ?? ''),
      condition: (x.condition === 'below' ? 'below' : 'above') as 'above' | 'below',
      price: typeof x.price === 'number' ? x.price : 0,
      alertType: (x.alertType as AlertDoc['alertType']) ?? 'once',
      active: x.active !== false,
      createdAt: typeof x.createdAt === 'string' ? x.createdAt : new Date().toISOString(),
      triggeredAt: typeof x.triggeredAt === 'string' ? x.triggeredAt : undefined,
      triggerCount: typeof x.triggerCount === 'number' ? x.triggerCount : 0,
    });
  });
  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return out;
}
