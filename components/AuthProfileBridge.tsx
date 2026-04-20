import { useEffect } from 'react';

import { subscribeAuth } from '@/services/auth/authProvider';
import { useLedgerStore } from '@/store/ledgerStore';
import { useMultiMarketBalanceStore } from '@/store/multiMarketBalanceStore';
import { useProfileStore } from '@/store/profileStore';
import { useWalletStore } from '@/store/walletStore';
import { useWatchlistListsStore } from '@/store/watchlistListsStore';

/** Keeps `profileStore` aligned with Firebase Auth + Firestore profile. Mount once under root. */
export function AuthProfileBridge() {
  useEffect(() => {
    const unsub = subscribeAuth((user) => {
      useProfileStore.getState().setFirebaseUser(user);
      void useProfileStore.getState().hydrateFromFirestore();
      if (user) {
        void useWatchlistListsStore.getState().refresh();
        void useMultiMarketBalanceStore.getState().hydrateFromCloud();
        void useLedgerStore.getState().hydrateFromCloud();
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    return useWalletStore.subscribe(() => {
      useProfileStore.getState().refreshGlobalEarnings({ pushToCloud: false });
    });
  }, []);

  return null;
}
