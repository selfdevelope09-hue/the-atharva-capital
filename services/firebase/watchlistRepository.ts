import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { auth, db, isFirebaseConfigured } from '@/config/firebaseConfig';

export type WatchlistDoc = {
  id: string;
  name: string;
  symbols: string[];
  order: number;
};

function requireUid(): string {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('[watchlists] Not signed in');
  return uid;
}

function col(uid: string) {
  if (!isFirebaseConfigured || !db) throw new Error('[watchlists] Firestore not configured');
  return collection(db, 'users', uid, 'watchlists');
}

export async function loadUserWatchlists(): Promise<WatchlistDoc[]> {
  const uid = requireUid();
  const q = query(col(uid), orderBy('order', 'asc'));
  const snap = await getDocs(q);
  const out: WatchlistDoc[] = [];
  snap.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    out.push({
      id: d.id,
      name: typeof data.name === 'string' ? data.name : 'Unnamed',
      symbols: Array.isArray(data.symbols) ? (data.symbols as string[]) : [],
      order: typeof data.order === 'number' ? data.order : 0,
    });
  });
  return out;
}

export async function saveWatchlist(docId: string, payload: { name: string; symbols: string[]; order: number }) {
  const uid = requireUid();
  await setDoc(doc(col(uid), docId), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
}

export async function removeWatchlist(docId: string) {
  const uid = requireUid();
  await deleteDoc(doc(col(uid), docId));
}
