import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

/**
 * Local-only crypto watchlist (starred symbols). Persisted to AsyncStorage so
 * the user's stars survive a reload on both native and web.
 *
 * Intentionally decoupled from the Firebase user watchlist so it works while
 * the user is logged out.
 */

const STORAGE_KEY = 'crypto.watchlist.v1';

type CryptoWatchlistState = {
  stars: Set<string>;
  ready: boolean;
  hydrate: () => Promise<void>;
  isStarred: (symbol: string) => boolean;
  toggle: (symbol: string) => void;
};

export const useCryptoWatchlistStore = create<CryptoWatchlistState>((set, get) => ({
  stars: new Set(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']),
  ready: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          set({ stars: new Set(parsed.map(String).map((s) => s.toUpperCase())) });
        }
      }
    } catch {
      // ignore — fallback to defaults
    } finally {
      set({ ready: true });
    }
  },
  isStarred: (symbol) => get().stars.has(symbol.toUpperCase()),
  toggle: (symbol) => {
    const s = symbol.toUpperCase();
    const next = new Set(get().stars);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    set({ stars: next });
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next))).catch(() => {
      // persistence best-effort
    });
  },
}));
