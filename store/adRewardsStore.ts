/**
 * Phase 27 — Rewarded unlocks + virtual cash from ads (client-side paper state).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AppMarket } from '@/constants/appMarkets';
import { applyBalanceDelta } from '@/services/firebase/userBalancesRepository';
import { auth, isFirebaseConfigured } from '@/config/firebaseConfig';
import { useMultiMarketBalanceStore } from '@/store/multiMarketBalanceStore';

const TWENTY_FOUR_H = 24 * 60 * 60 * 1000;

type State = {
  /** Paper USD credited from rewarded ads */
  virtualCashUsd: number;
  /** Epoch ms — rewarded unlock for premium regions + leaderboard extras */
  premiumUnlockUntil: number;
  leaderboardFullStatsUntil: number;
  addVirtualCash: (usd: number) => void;
  grantUnlocksFromReward: () => void;
  hasPremiumMarketAccess: () => boolean;
  hasLeaderboardFullStats: () => boolean;
};

export const useAdRewardsStore = create<State>()(
  persist(
    (set, get) => ({
      virtualCashUsd: 0,
      premiumUnlockUntil: 0,
      leaderboardFullStatsUntil: 0,

      addVirtualCash: (usd) => {
        set((s) => ({ virtualCashUsd: s.virtualCashUsd + usd }));
        const creditUsd = async () => {
          if (isFirebaseConfigured && auth?.currentUser) {
            try {
              await applyBalanceDelta('usa' as AppMarket, usd);
              await useMultiMarketBalanceStore.getState().hydrateFromCloud();
            } catch {
              await useMultiMarketBalanceStore.getState().applyDelta('usa', usd, false);
            }
          } else {
            await useMultiMarketBalanceStore.getState().applyDelta('usa', usd, false);
          }
        };
        void creditUsd();
      },

      grantUnlocksFromReward: () => {
        const until = Date.now() + TWENTY_FOUR_H;
        set({
          premiumUnlockUntil: until,
          leaderboardFullStatsUntil: until,
        });
      },

      hasPremiumMarketAccess: () => Date.now() < get().premiumUnlockUntil,
      hasLeaderboardFullStats: () => Date.now() < get().leaderboardFullStatsUntil,
    }),
    {
      name: 'atc-ad-rewards-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        virtualCashUsd: s.virtualCashUsd,
        premiumUnlockUntil: s.premiumUnlockUntil,
        leaderboardFullStatsUntil: s.leaderboardFullStatsUntil,
      }),
    }
  )
);

export const PREMIUM_MARKET_IDS = ['switzerland', 'germany'] as const;
