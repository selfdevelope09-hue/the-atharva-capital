import { create } from 'zustand';

export type MarketId = 'IN' | 'US' | 'CRYPTO';

type AppState = {
  activeMarket: MarketId;
  setActiveMarket: (market: MarketId) => void;
};

export const useAppStore = create<AppState>((set) => ({
  activeMarket: 'IN',
  setActiveMarket: (market) => set({ activeMarket: market }),
}));
