import { doc, getDoc, setDoc } from 'firebase/firestore';
import { create } from 'zustand';

import { auth, db, isFirebaseConfigured } from '@/config/firebaseConfig';
import {
  loadUserWatchlists,
  removeWatchlist,
  saveWatchlist,
  type WatchlistDoc,
} from '@/services/firebase/watchlistRepository';

type WatchlistListsState = {
  lists: WatchlistDoc[];
  activeListId: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  selectList: (id: string) => Promise<void>;
  createList: (name: string) => Promise<void>;
  renameList: (id: string, name: string) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  setSymbolsForActive: (symbols: string[]) => Promise<void>;
};

async function persistActiveId(uid: string, id: string | null) {
  if (!isFirebaseConfigured || !db) return;
  await setDoc(
    doc(db, 'users', uid, 'settings', 'watchlists'),
    { activeListId: id, updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

export const useWatchlistListsStore = create<WatchlistListsState>((set, get) => ({
  lists: [],
  activeListId: null,
  loading: false,
  error: null,

  refresh: async () => {
    if (!auth?.currentUser || !isFirebaseConfigured || !db) {
      set({ lists: [], activeListId: null, loading: false });
      return;
    }
    set({ loading: true, error: null });
    try {
      let lists = await loadUserWatchlists();
      if (lists.length === 0) {
        await saveWatchlist('default', { name: 'Main', symbols: ['RELIANCE', 'HDFCBANK', 'SBIN'], order: 0 });
        lists = await loadUserWatchlists();
      }
      let preferred: string | null = null;
      try {
        const uid = auth.currentUser.uid;
        const snap = await getDoc(doc(db, 'users', uid, 'settings', 'watchlists'));
        const a = snap.data()?.activeListId;
        if (typeof a === 'string' && lists.some((l) => l.id === a)) preferred = a;
      } catch {
        // ignore missing settings doc
      }
      const active =
        preferred ??
        (get().activeListId && lists.some((l) => l.id === get().activeListId) ? get().activeListId : lists[0]?.id ?? null);
      set({ lists, activeListId: active, loading: false });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : 'Watchlists failed',
        loading: false,
      });
    }
  },

  selectList: async (id) => {
    set({ activeListId: id });
    const uid = auth?.currentUser?.uid;
    if (uid) await persistActiveId(uid, id);
  },

  createList: async (name) => {
    const uid = auth?.currentUser?.uid;
    if (!uid) return;
    const id = `wl_${Math.random().toString(36).slice(2, 10)}`;
    const order = get().lists.length;
    await saveWatchlist(id, { name: name.trim() || 'New list', symbols: [], order });
    await get().refresh();
    await get().selectList(id);
  },

  renameList: async (id, name) => {
    const list = get().lists.find((l) => l.id === id);
    if (!list) return;
    await saveWatchlist(id, { ...list, name: name.trim() || list.name });
    await get().refresh();
  },

  deleteList: async (id) => {
    await removeWatchlist(id);
    await get().refresh();
    const next = get().lists[0]?.id ?? null;
    set({ activeListId: next });
    const uid = auth?.currentUser?.uid;
    if (uid) await persistActiveId(uid, next);
  },

  setSymbolsForActive: async (symbols) => {
    const id = get().activeListId;
    const list = get().lists.find((l) => l.id === id);
    if (!id || !list) return;
    await saveWatchlist(id, { ...list, symbols });
    await get().refresh();
  },
}));
