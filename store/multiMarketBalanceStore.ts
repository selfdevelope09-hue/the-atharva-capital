/**
 * Phase 1 — Per-market virtual balances (local currency units).
 * Mutations that must survive refresh go through `userBalancesRepository` + `runTransaction`.
 */

import { create } from 'zustand';

import type { AppMarket } from '@/constants/appMarkets';
import { STARTING_BALANCES, TOP_UP_AMOUNT } from '@/constants/appMarkets';
import {
  applyBalanceDelta as cloudApplyDelta,
  loadBalancesFromCloud,
  setMarketBalance as cloudSetMarket,
} from '@/services/firebase/userBalancesRepository';
import { fetchUsdBaseRates, amountToUsd } from '@/services/fx/frankfurter';
import type { UserBalances } from '@/types/firestoreUser';

/** ISO codes for Frankfurter (USDT tracked as USD). */
const MARKET_FIAT: Record<AppMarket, string> = {
  crypto: 'USD',
  india: 'INR',
  usa: 'USD',
  uk: 'GBP',
  china: 'CNY',
  japan: 'JPY',
  australia: 'AUD',
  germany: 'EUR',
  canada: 'CAD',
  switzerland: 'CHF',
};

export type MultiMarketBalanceState = {
  balances: UserBalances;
  /** Last ISO day (UTC) we allowed a free top-up per market */
  lastTopUpDay: Partial<Record<AppMarket, string>>;
  usdRates: Record<string, number> | null;
  ratesFetchedAt: number | null;
  /** Hydrate from Firestore (no-op if offline / anon) */
  hydrateFromCloud: () => Promise<void>;
  /** Refresh FX cache (hourly TTL inside frankfurter module also applies) */
  refreshFx: () => Promise<void>;
  /** Local apply + optional cloud sync */
  applyDelta: (market: AppMarket, delta: number, syncCloud: boolean) => Promise<void>;
  resetMarket: (market: AppMarket, syncCloud: boolean) => Promise<void>;
  topUp: (market: AppMarket, syncCloud: boolean) => Promise<boolean>;
  totalPortfolioUsd: () => number;
  /** USDT/crypto bucket uses USD rate table */
  balanceToUsd: (market: AppMarket, amount: number) => number;
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultState(): UserBalances {
  return { ...STARTING_BALANCES };
}

export const useMultiMarketBalanceStore = create<MultiMarketBalanceState>((set, get) => ({
  balances: defaultState(),
  lastTopUpDay: {},
  usdRates: null,
  ratesFetchedAt: null,

  hydrateFromCloud: async () => {
    try {
      const remote = await loadBalancesFromCloud();
      if (remote) set({ balances: remote });
      await get().refreshFx();
    } catch {
      /* offline / missing Firebase */
    }
  },

  refreshFx: async () => {
    try {
      const rates = await fetchUsdBaseRates();
      set({ usdRates: rates, ratesFetchedAt: Date.now() });
    } catch {
      /* keep prior */
    }
  },

  applyDelta: async (market, delta, syncCloud) => {
    if (syncCloud) {
      const next = await cloudApplyDelta(market, delta);
      set({ balances: next });
      return;
    }
    set((s) => {
      const balances = { ...s.balances };
      balances[market] = Math.max(0, (balances[market] ?? 0) + delta);
      return { balances };
    });
  },

  resetMarket: async (market, syncCloud) => {
    const start = STARTING_BALANCES[market];
    if (syncCloud) {
      const next = await cloudSetMarket(market, start);
      set({ balances: next });
      return;
    }
    set((s) => {
      const balances = { ...s.balances };
      balances[market] = start;
      return { balances };
    });
  },

  topUp: async (market, syncCloud) => {
    const day = todayUtc();
    const last = get().lastTopUpDay[market];
    if (last === day) return false;
    const amt = TOP_UP_AMOUNT[market];
    await get().applyDelta(market, amt, syncCloud);
    set((s) => ({
      lastTopUpDay: { ...s.lastTopUpDay, [market]: day },
    }));
    return true;
  },

  totalPortfolioUsd: () => {
    const { balances, usdRates } = get();
    if (!usdRates) {
      return Object.entries(balances).reduce((acc, [m, v]) => {
        const mm = m as AppMarket;
        if (mm === 'usa' || mm === 'crypto') return acc + v;
        return acc;
      }, 0);
    }
    let t = 0;
    for (const m of Object.keys(balances) as AppMarket[]) {
      const fiat = MARKET_FIAT[m];
      t += amountToUsd(balances[m] ?? 0, fiat, usdRates);
    }
    return t;
  },

  balanceToUsd: (market, amount) => {
    const rates = get().usdRates;
    if (!rates) return market === 'usa' || market === 'crypto' ? amount : amount;
    return amountToUsd(amount, MARKET_FIAT[market], rates);
  },
}));
