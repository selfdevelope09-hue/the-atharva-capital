import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  useUnifiedMarketsPrices,
  type UnifiedMarketTick,
} from '@/contexts/UnifiedMarketsPriceContext';

/**
 * PriceContext — single global WebSocket to Binance public mini-ticker stream.
 *
 * Endpoint (per spec): `wss://stream.binance.com:9443/ws/!miniTicker@arr`
 * Payload shape: array of
 *   { e: '24hrMiniTicker', s, c, o, h, l, v, q, ... }
 *
 * 24h change % is derived locally as `(c - o) / o * 100` (miniTicker omits P).
 *
 * Reconnects automatically on `onclose` / `onerror` with a 3 s delay.
 * One socket shared across the entire crypto section.
 */

export const BINANCE_MINI_TICKER_WS =
  'wss://stream.binance.com:9443/ws/!miniTicker@arr';

export type PriceTick = {
  /** e.g. "BTCUSDT" */
  symbol: string;
  /** Last / close price. */
  price: number;
  /** 24h open price (needed for change %). */
  open24h: number;
  /** 24h high. */
  high24h: number;
  /** 24h low. */
  low24h: number;
  /** Base asset volume (24h). */
  baseVolume: number;
  /** Quote asset volume in USDT (24h). */
  quoteVolume: number;
  /** Derived percent change over the last 24h. */
  changePct24h: number;
  /** epoch ms of the last update. */
  updatedAt: number;
};

export type PriceMap = Record<string, PriceTick>;

type PriceContextValue = {
  /** Map keyed by symbol uppercased (e.g. `BTCUSDT`). */
  prices: PriceMap;
  /** Snapshot getter — avoids re-renders when you only need an imperative read. */
  getPrice: (symbol: string) => PriceTick | undefined;
  /** WebSocket state for the status pill / live dot. */
  status: 'connecting' | 'open' | 'reconnecting' | 'closed';
  /** # of reconnection attempts since last healthy connection. */
  reconnectAttempts: number;
};

const PriceContext = createContext<PriceContextValue | null>(null);

function unifiedCryptoToPriceTick(t: UnifiedMarketTick): PriceTick {
  const price = t.price ?? 0;
  const open = t.open ?? price;
  return {
    symbol: t.symbol,
    price,
    open24h: open,
    high24h: t.high ?? price,
    low24h: t.low ?? price,
    baseVolume: 0,
    quoteVolume: t.volume ?? 0,
    changePct24h: t.changePct ?? 0,
    updatedAt: t.updatedAt,
  };
}

/**
 * Crypto prices come from the same Binance stream as `UnifiedMarketsPriceProvider`
 * (no second WebSocket).
 */
function PriceProviderBridge({ children }: { children: ReactNode }) {
  const { ticks, wsStatus, subscribeMarket, unsubscribeMarket } = useUnifiedMarketsPrices();
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const prevStatus = useRef(wsStatus);

  useEffect(() => {
    subscribeMarket('crypto');
    return () => unsubscribeMarket('crypto');
  }, [subscribeMarket, unsubscribeMarket]);

  useEffect(() => {
    if (prevStatus.current === 'open' && (wsStatus === 'closed' || wsStatus === 'error')) {
      setReconnectAttempts((n) => n + 1);
    }
    prevStatus.current = wsStatus;
  }, [wsStatus]);

  const prices = useMemo(() => {
    const out: PriceMap = {};
    for (const k in ticks) {
      const t = ticks[k];
      if (t?.market === 'crypto') {
        out[k] = unifiedCryptoToPriceTick(t);
      }
    }
    return out;
  }, [ticks]);

  const pricesRef = useRef(prices);
  pricesRef.current = prices;

  const status: PriceContextValue['status'] =
    wsStatus === 'open'
      ? 'open'
      : wsStatus === 'connecting'
        ? 'connecting'
        : wsStatus === 'closed' || wsStatus === 'error'
          ? 'reconnecting'
          : 'closed';

  const getPrice = useCallback((symbol: string) => pricesRef.current[symbol?.toUpperCase() ?? ''], []);

  const value = useMemo<PriceContextValue>(
    () => ({ prices, getPrice, status, reconnectAttempts }),
    [prices, getPrice, status, reconnectAttempts]
  );

  return <PriceContext.Provider value={value}>{children}</PriceContext.Provider>;
}

/** Must render inside root `UnifiedMarketsPriceProvider`. Single Binance connection for crypto. */
export function PriceProvider({ children }: { children: ReactNode }) {
  return <PriceProviderBridge>{children}</PriceProviderBridge>;
}

export function usePriceContext(): PriceContextValue {
  const ctx = useContext(PriceContext);
  if (!ctx) {
    throw new Error('usePriceContext must be used inside <PriceProvider>');
  }
  return ctx;
}

/** Convenience: subscribe to a single symbol's live tick (re-renders on change). */
export function usePriceTick(symbol: string | null | undefined): PriceTick | undefined {
  const { prices } = usePriceContext();
  return symbol ? prices[symbol.toUpperCase()] : undefined;
}

/** List of all USDT quote markets, sorted by 24h quote volume desc. */
export function useTopUsdtMarkets(limit = 500): PriceTick[] {
  const { prices } = usePriceContext();
  return useMemo(() => {
    const arr: PriceTick[] = [];
    for (const k in prices) {
      if (k.endsWith('USDT')) arr.push(prices[k]!);
    }
    arr.sort((a, b) => b.quoteVolume - a.quoteVolume);
    return arr.slice(0, limit);
  }, [prices, limit]);
}

// --- Phase 1: all 9 markets (Binance + Yahoo), ticks scoped with `market` on each row ---
export {
  UnifiedMarketsPriceProvider,
  useUnifiedMarketsPrices,
} from '@/contexts/UnifiedMarketsPriceContext';
