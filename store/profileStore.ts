import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { create } from 'zustand';

import { auth, db, isFirebaseConfigured } from '@/config/firebaseConfig';
import { generateAtcClientId } from '@/lib/clientId';
import { syncWalletToCloud } from '@/services/firebase/dbManager';
import { useWalletStore } from '@/store/walletStore';

/**
 * Global earnings in USD: canonical `baseUsd` cross-checked against every regional FX sleeve
 * (India, US, UK, EU, JP, CN, AU, CA, CH) by converting local notionals back to USD — mean ≈ `baseUsd`.
 */
export function computeGlobalNetWorthUsd(): number {
  const w = useWalletStore.getState();
  const base = w.baseUsd;
  const pocketsUsd = [
    base,
    w.getInrFromBaseUsd() / Math.max(w.usdToInr, 1e-9),
    w.getCnyFromBaseUsd() / Math.max(w.usdToCny, 1e-9),
    w.getJpyFromBaseUsd() / Math.max(w.usdToJpy, 1e-9),
    w.getGbpFromBaseUsd() / Math.max(w.usdToGbp, 1e-9),
    w.getAudFromBaseUsd() / Math.max(w.usdToAud, 1e-9),
    w.getEurFromBaseUsd() / Math.max(w.usdToEur, 1e-9),
    w.getCadFromBaseUsd() / Math.max(w.usdToCad, 1e-9),
    w.getChfFromBaseUsd() / Math.max(w.usdToChf, 1e-9),
  ];
  return pocketsUsd.reduce((a, b) => a + b, 0) / pocketsUsd.length;
}

export type ProfileState = {
  firebaseUser: User | null;
  clientId: string | null;
  cloudUsername: string | null;
  totalNetWorthUsd: number;
  setFirebaseUser: (user: User | null) => void;
  /** Pull wallet + crypto stores, refresh `totalNetWorthUsd`, optionally push to Firestore. */
  refreshGlobalEarnings: (options?: { pushToCloud?: boolean }) => Promise<void>;
  /** Load `clientId` / username from Firestore; mint `clientId` if missing. */
  hydrateFromFirestore: () => Promise<void>;
  /** Re-run hydration + earnings sync (call after trades). */
  refreshUser: () => Promise<void>;
};

export const useProfileStore = create<ProfileState>((set, get) => ({
  firebaseUser: null,
  clientId: null,
  cloudUsername: null,
  totalNetWorthUsd: computeGlobalNetWorthUsd(),

  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),

  refreshGlobalEarnings: async (options) => {
    const total = computeGlobalNetWorthUsd();
    set({ totalNetWorthUsd: total });
    if (options?.pushToCloud && isFirebaseConfigured && auth?.currentUser) {
      try {
        await syncWalletToCloud(total);
      } catch {
        // non-fatal; leaderboard sync is best-effort
      }
    }
  },

  refreshUser: async () => {
    await get().hydrateFromFirestore();
  },

  hydrateFromFirestore: async () => {
    const user = auth?.currentUser;
    if (!user || !isFirebaseConfigured || !db) {
      await get().refreshGlobalEarnings({ pushToCloud: false });
      return;
    }
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const cid = generateAtcClientId();
      await setDoc(
        ref,
        {
          uid: user.uid,
          clientId: cid,
          username: user.displayName ?? `Trader_${user.uid.slice(0, 4)}`,
          totalNetWorth: computeGlobalNetWorthUsd(),
        },
        { merge: true }
      );
      set({ clientId: cid, cloudUsername: user.displayName });
    } else {
      const data = snap.data() as Record<string, unknown>;
      let clientId = typeof data.clientId === 'string' ? data.clientId : null;
      if (!clientId) {
        clientId = generateAtcClientId();
        await setDoc(ref, { clientId }, { merge: true });
      }
      set({
        clientId,
        cloudUsername: typeof data.username === 'string' ? data.username : null,
      });
    }
    await get().refreshGlobalEarnings({ pushToCloud: true });
  },
}));
