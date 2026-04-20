/**
 * Per-market watchlists: `users/{uid}/watchlistsPerMarket/{market}/lists/{watchlistId}`
 * Matches isolation: each market is a separate sub-tree (max 10 lists per market in app layer).
 */

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  orderBy,
} from 'firebase/firestore';

import type { AppMarket } from '@/constants/appMarkets';
import { MARKETS, type MarketId } from '@/src/constants/markets';
import { auth, db, isFirebaseConfigured } from '@/config/firebaseConfig';

export type MarketWatchlistDoc = {
  id: string;
  name: string;
  market: AppMarket;
  symbols: string[];
  color: string;
  createdAt: string;
  order: number;
};

const MAX_LISTS_PER_MARKET = 10;

function requireUid(): string {
  const u = auth?.currentUser?.uid;
  if (!u) throw new Error('[marketWatchlists] Not signed in');
  return u;
}

function listsCol(uid: string, market: AppMarket) {
  if (!isFirebaseConfigured || !db) throw new Error('[marketWatchlists] Firestore not configured');
  return collection(db, 'users', uid, 'watchlistsPerMarket', market, 'lists');
}

export async function countMarketWatchlists(uid: string, market: AppMarket): Promise<number> {
  if (!isFirebaseConfigured || !db) return 0;
  const snap = await getDocs(listsCol(uid, market));
  return snap.size;
}

export async function loadMarketWatchlists(market: AppMarket): Promise<MarketWatchlistDoc[]> {
  const uid = requireUid();
  const q = query(listsCol(uid, market), orderBy('order', 'asc'));
  const snap = await getDocs(q);
  const out: MarketWatchlistDoc[] = [];
  snap.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    out.push({
      id: d.id,
      name: typeof data.name === 'string' ? data.name : 'Unnamed',
      market,
      symbols: Array.isArray(data.symbols) ? (data.symbols as string[]) : [],
      color: typeof data.color === 'string' ? data.color : '#f0b90b',
      createdAt:
        typeof data.createdAt === 'string'
          ? data.createdAt
          : new Date().toISOString(),
      order: typeof data.order === 'number' ? data.order : 0,
    });
  });
  return out;
}

export async function saveMarketWatchlist(
  market: AppMarket,
  watchlistId: string,
  payload: Omit<MarketWatchlistDoc, 'id' | 'market'>
): Promise<void> {
  const uid = requireUid();
  await setDoc(
    doc(listsCol(uid, market), watchlistId),
    {
      ...payload,
      market,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function createMarketWatchlist(
  market: AppMarket,
  input: { name: string; color: string; symbols?: string[] }
): Promise<string> {
  const uid = requireUid();
  const n = await countMarketWatchlists(uid, market);
  if (n >= MAX_LISTS_PER_MARKET) {
    throw new Error(`Maximum ${MAX_LISTS_PER_MARKET} watchlists per market`);
  }
  const id = `wl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await setDoc(doc(listsCol(uid, market), id), {
    name: input.name.trim() || 'My Picks',
    market,
    symbols: input.symbols ?? [],
    color: input.color,
    createdAt: new Date().toISOString(),
    order: n,
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function removeMarketWatchlist(market: AppMarket, watchlistId: string): Promise<void> {
  const uid = requireUid();
  await deleteDoc(doc(listsCol(uid, market), watchlistId));
}

function defaultWatchlistName(market: AppMarket): string {
  const cfg = MARKETS[market as MarketId];
  const raw = cfg?.name ?? String(market);
  const short = raw.includes('(') ? raw.split('(')[0].trim() : raw;
  return `My ${short} Picks`;
}

function defaultWatchlistColor(market: AppMarket): string {
  return MARKETS[market as MarketId]?.accentColor ?? '#f0b90b';
}

/**
 * If the user has zero lists for this market, create "My {Market} Picks".
 * No-op when not signed in / Firestore off.
 */
export async function ensureDefaultMarketWatchlist(market: AppMarket): Promise<void> {
  if (!isFirebaseConfigured || !auth?.currentUser) return;
  const uid = auth.currentUser.uid;
  const n = await countMarketWatchlists(uid, market);
  if (n > 0) return;
  await createMarketWatchlist(market, {
    name: defaultWatchlistName(market),
    color: defaultWatchlistColor(market),
    symbols: [],
  });
}

export { MAX_LISTS_PER_MARKET };
