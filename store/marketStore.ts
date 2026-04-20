import { create } from 'zustand';

export type ActiveMarket =
  | 'INDIA'
  | 'US'
  | 'CHINA'
  | 'JAPAN'
  | 'UK'
  | 'AUSTRALIA'
  | 'GERMANY'
  | 'CANADA'
  | 'SWITZERLAND'
  | 'CRYPTO';

export type StreamProvider = 'NONE' | 'BINANCE' | 'ALPACA' | 'ANGEL' | 'SINA' | 'FMP';

/** Unified tick shape — UI reads this regardless of venue. */
export type LiveQuote = {
  ltp: number;
  change24hPct: number;
  updatedAt: number;
  high24?: number;
  low24?: number;
  quoteVolume24h?: number;
};

/** Payload for throttled Binance batches (shared with `utils/performance/throttler`). */
export type LiveQuoteMergePayload = {
  ltp: number;
  change24hPct: number;
  source: StreamProvider;
  high24?: number;
  low24?: number;
  quoteVolume24h?: number;
};

type MarketState = {
  activeMarket: ActiveMarket;
  setActiveMarket: (market: ActiveMarket) => void;

  /** Symbol shown in pro chart / order sidebar (e.g. BTCUSDT, RELIANCE). */
  chartTicker: string;
  setChartTicker: (symbol: string) => void;

  /** Canonical live prices keyed by venue symbol (e.g. BTCUSDT, AAPL). */
  liveQuotes: Record<string, LiveQuote>;
  /** Which transport last wrote to `liveQuotes` (for debugging / badges). */
  activeDataSource: StreamProvider;
  mergeLiveQuote: (symbol: string, ltp: number, change24hPct: number, source: StreamProvider) => void;
  /** Single `set()` for many symbols — use with throttled WebSocket batches. */
  mergeLiveQuotesBatch: (batch: Record<string, LiveQuoteMergePayload>) => void;
  clearLiveQuotes: () => void;
};

export const useMarketStore = create<MarketState>((set) => ({
  activeMarket: 'INDIA',
  setActiveMarket: (market) => set({ activeMarket: market }),

  chartTicker: '',
  setChartTicker: (symbol) => set({ chartTicker: symbol.trim().toUpperCase() }),

  liveQuotes: {},
  activeDataSource: 'NONE',

  mergeLiveQuote: (symbol, ltp, change24hPct, source) =>
    set((s) => {
      const prev = s.liveQuotes[symbol];
      if (
        prev &&
        prev.ltp === ltp &&
        prev.change24hPct === change24hPct &&
        s.activeDataSource === source
      ) {
        return s;
      }
      return {
        liveQuotes: {
          ...s.liveQuotes,
          [symbol]: { ltp, change24hPct, updatedAt: Date.now() },
        },
        activeDataSource: source,
      };
    }),

  mergeLiveQuotesBatch: (batch) =>
    set((s) => {
      const keys = Object.keys(batch);
      if (keys.length === 0) return s;
      const next = { ...s.liveQuotes };
      let changed = false;
      let activeDataSource = s.activeDataSource;
      const now = Date.now();
      for (const symbol of keys) {
        const u = batch[symbol];
        if (!u) continue;
        const prev = next[symbol];
        const merged: LiveQuote = {
          ltp: u.ltp,
          change24hPct: u.change24hPct,
          updatedAt: now,
          high24: u.high24 ?? prev?.high24,
          low24: u.low24 ?? prev?.low24,
          quoteVolume24h: u.quoteVolume24h ?? prev?.quoteVolume24h,
        };
        if (
          prev &&
          prev.ltp === merged.ltp &&
          prev.change24hPct === merged.change24hPct &&
          prev.high24 === merged.high24 &&
          prev.low24 === merged.low24 &&
          prev.quoteVolume24h === merged.quoteVolume24h &&
          s.activeDataSource === u.source
        ) {
          continue;
        }
        next[symbol] = merged;
        activeDataSource = u.source;
        changed = true;
      }
      if (!changed) return s;
      return { liveQuotes: next, activeDataSource };
    }),

  clearLiveQuotes: () => set({ liveQuotes: {}, activeDataSource: 'NONE' }),
}));
