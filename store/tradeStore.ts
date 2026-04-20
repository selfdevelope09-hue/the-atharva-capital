import { create } from 'zustand';

import { refreshUser } from '@/services/user/refreshUser';
import { useWalletStore } from '@/store/walletStore';
import type { ActiveMarket } from '@/store/marketStore';

export type VirtualTrade = {
  id: string;
  createdAt: string;
  market: ActiveMarket;
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  price: number;
  feeUsd: number;
  notionalUsd: number;
};

type PlaceVirtualTradeInput = {
  market: ActiveMarket;
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  price: number;
  /** Taker fee rate applied to notional (e.g. 0.0005). */
  feeRate: number;
  /**
   * Optional: notional already in USD terms. If omitted, `qty * price` is used.
   * India flow can pass INR-equivalent already converted to USD.
   */
  notionalUsdOverride?: number;
};

type TradeStoreState = {
  trades: VirtualTrade[];
  placeVirtualTrade: (input: PlaceVirtualTradeInput) => VirtualTrade;
};

function id() {
  return `vt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useTradeStore = create<TradeStoreState>((set) => ({
  trades: [],

  placeVirtualTrade: (input) => {
    const notionalUsd = input.notionalUsdOverride ?? Math.abs(input.qty * input.price);
    const feeUsd = notionalUsd * input.feeRate;
    const row: VirtualTrade = {
      id: id(),
      createdAt: new Date().toISOString(),
      market: input.market,
      symbol: input.symbol.toUpperCase(),
      side: input.side,
      qty: input.qty,
      price: input.price,
      feeUsd,
      notionalUsd,
    };

    const { adjustBaseUsd } = useWalletStore.getState();
    if (input.side === 'buy') {
      adjustBaseUsd(-(notionalUsd + feeUsd));
    } else {
      adjustBaseUsd(notionalUsd - feeUsd);
    }

    set((s) => ({ trades: [row, ...s.trades].slice(0, 500) }));
    void refreshUser().catch(() => {
      /* profile sync best-effort */
    });
    return row;
  },
}));
