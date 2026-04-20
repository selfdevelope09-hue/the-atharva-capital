/**
 * Phase 1 — All 9 markets: Binance mini-ticker (crypto) + Yahoo v8 chart poll (others).
 * Every tick includes `market` for strict isolation in UI layers.
 *
 * Not a UI component — provider only. Legacy crypto-only flow remains in `PriceContext.tsx`.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { MARKETS, type MarketConfig, type MarketId, yahooSymbolFor } from '@/src/constants/markets';
import { fetchYahooBatch, type YahooQuote } from '@/src/services/yahooFinance';

const BINANCE_WS = 'wss://stream.binance.com:9443/ws/!miniTicker@arr';
const YAHOO_POLL_MS = 15000;
const WS_RECONNECT_MS = 3000;
const WS_BATCH_MS = 250;

export type UnifiedMarketTick = {
  market: MarketId;
  symbol: string;
  price: number | null;
  changePct: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  marketState?: string | null;
  preMarketPrice?: number | null;
  postMarketPrice?: number | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  updatedAt: number;
};

export type WsStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export type UnifiedMarketsPriceContextValue = {
  /** Flat map keyed by venue symbol (e.g. `BTCUSDT`, `RELIANCE.NS`). Each tick carries `market`. */
  ticks: Record<string, UnifiedMarketTick>;
  wsStatus: WsStatus;
  subscribeMarket: (id: MarketId) => void;
  unsubscribeMarket: (id: MarketId) => void;
  getTick: (symbolFull: string) => UnifiedMarketTick | undefined;
  /** Isolation-safe: only symbols belonging to `market`. */
  getTicksForMarket: (market: MarketId) => UnifiedMarketTick[];
  getTickInMarket: (market: MarketId, symbolFull: string) => UnifiedMarketTick | undefined;
};

const Ctx = createContext<UnifiedMarketsPriceContextValue | null>(null);

export function UnifiedMarketsPriceProvider({ children }: { children: React.ReactNode }) {
  const [ticks, setTicks] = useState<Record<string, UnifiedMarketTick>>({});
  const [wsStatus, setWsStatus] = useState<WsStatus>('idle');

  const subs = useRef<Set<MarketId>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const wsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsBatchRef = useRef<Record<string, UnifiedMarketTick>>({});
  const wsFlushRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const yahooTimers = useRef<Map<MarketId, ReturnType<typeof setInterval>>>(new Map());
  const yahooAborts = useRef<Map<MarketId, AbortController>>(new Map());

  const scheduleFlush = useCallback(() => {
    if (wsFlushRef.current) return;
    wsFlushRef.current = setTimeout(() => {
      wsFlushRef.current = null;
      const batch = wsBatchRef.current;
      wsBatchRef.current = {};
      if (Object.keys(batch).length === 0) return;
      setTicks((prev) => ({ ...prev, ...batch }));
    }, WS_BATCH_MS);
  }, []);

  const connectBinance = useCallback(() => {
    if (wsRef.current) return;
    setWsStatus('connecting');
    try {
      const ws = new WebSocket(BINANCE_WS);
      wsRef.current = ws;
      ws.onopen = () => setWsStatus('open');
      ws.onmessage = (ev) => {
        try {
          const arr = JSON.parse(ev.data);
          if (!Array.isArray(arr)) return;
          const now = Date.now();
          for (const t of arr) {
            const symbol = t.s;
            if (!symbol || !String(symbol).endsWith('USDT')) continue;
            const close = parseFloat(t.c);
            const open = parseFloat(t.o);
            const high = parseFloat(t.h);
            const low = parseFloat(t.l);
            const volume = parseFloat(t.q);
            const changePct = isFinite(open) && open !== 0 ? ((close - open) / open) * 100 : null;
            wsBatchRef.current[symbol] = {
              market: 'crypto',
              symbol,
              price: isFinite(close) ? close : null,
              changePct,
              open: isFinite(open) ? open : null,
              high: isFinite(high) ? high : null,
              low: isFinite(low) ? low : null,
              volume: isFinite(volume) ? volume : null,
              updatedAt: now,
            };
          }
          scheduleFlush();
        } catch {
          /* ignore */
        }
      };
      ws.onerror = () => setWsStatus('error');
      ws.onclose = () => {
        wsRef.current = null;
        setWsStatus('closed');
        if (subs.current.has('crypto')) {
          if (wsTimerRef.current) clearTimeout(wsTimerRef.current);
          wsTimerRef.current = setTimeout(() => connectBinance(), WS_RECONNECT_MS);
        }
      };
    } catch {
      setWsStatus('error');
      if (wsTimerRef.current) clearTimeout(wsTimerRef.current);
      wsTimerRef.current = setTimeout(() => connectBinance(), WS_RECONNECT_MS);
    }
  }, [scheduleFlush]);

  const disconnectBinance = useCallback(() => {
    if (wsTimerRef.current) {
      clearTimeout(wsTimerRef.current);
      wsTimerRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
    setWsStatus('closed');
  }, []);

  const pollYahoo = useCallback(async (cfg: MarketConfig) => {
    const pairFull = cfg.pairs.map((p) => yahooSymbolFor(cfg, p));
    const extras = cfg.yahooPollExtras ?? [];
    const fullSymbols = [...pairFull, ...extras];
    yahooAborts.current.get(cfg.id)?.abort();
    const ac = new AbortController();
    yahooAborts.current.set(cfg.id, ac);
    const quotes = await fetchYahooBatch(fullSymbols, ac.signal);
    const now = Date.now();
    const next: Record<string, UnifiedMarketTick> = {};

    const applyQuote = (full: string) => {
      const q: YahooQuote | undefined = quotes[full];
      if (!q) return;
      const prev = q.prevClose ?? q.open;
      const changePct = q.price != null && prev != null && prev !== 0 ? ((q.price - prev) / prev) * 100 : null;
      next[full] = {
        market: cfg.id,
        symbol: full,
        price: q.price,
        changePct,
        open: q.open,
        high: q.high,
        low: q.low,
        volume: q.volume,
        marketState: q.marketState,
        preMarketPrice: q.preMarketPrice,
        postMarketPrice: q.postMarketPrice,
        fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: q.fiftyTwoWeekLow,
        updatedAt: now,
      };
    };

    cfg.pairs.forEach((ticker) => applyQuote(yahooSymbolFor(cfg, ticker)));
    extras.forEach((full) => applyQuote(full));
    if (Object.keys(next).length === 0) return;
    setTicks((prev) => ({ ...prev, ...next }));
  }, []);

  const startYahoo = useCallback(
    (cfg: MarketConfig) => {
      if (yahooTimers.current.has(cfg.id)) return;
      pollYahoo(cfg);
      const t = setInterval(() => pollYahoo(cfg), YAHOO_POLL_MS);
      yahooTimers.current.set(cfg.id, t);
    },
    [pollYahoo]
  );

  const stopYahoo = useCallback((id: MarketId) => {
    const t = yahooTimers.current.get(id);
    if (t) clearInterval(t);
    yahooTimers.current.delete(id);
    yahooAborts.current.get(id)?.abort();
    yahooAborts.current.delete(id);
  }, []);

  const subscribeMarket = useCallback(
    (id: MarketId) => {
      if (subs.current.has(id)) return;
      subs.current.add(id);
      const cfg = MARKETS[id];
      if (!cfg) return;
      if (cfg.dataSource === 'binance_websocket') connectBinance();
      else startYahoo(cfg);
    },
    [connectBinance, startYahoo]
  );

  const unsubscribeMarket = useCallback(
    (id: MarketId) => {
      if (!subs.current.has(id)) return;
      subs.current.delete(id);
      const cfg = MARKETS[id];
      if (!cfg) return;
      if (cfg.dataSource === 'binance_websocket') {
        if (!subs.current.has('crypto')) disconnectBinance();
      } else {
        stopYahoo(id);
      }
    },
    [disconnectBinance, stopYahoo]
  );

  useEffect(() => {
    return () => {
      disconnectBinance();
      yahooTimers.current.forEach((t) => clearInterval(t));
      yahooTimers.current.clear();
      yahooAborts.current.forEach((ac) => ac.abort());
      yahooAborts.current.clear();
    };
  }, [disconnectBinance]);

  const getTick = useCallback((symbol: string) => ticks[symbol], [ticks]);

  const getTicksForMarket = useCallback(
    (market: MarketId) => {
      const out: UnifiedMarketTick[] = [];
      for (const k in ticks) {
        const t = ticks[k];
        if (t?.market === market) out.push(t);
      }
      return out;
    },
    [ticks]
  );

  const getTickInMarket = useCallback(
    (market: MarketId, symbolFull: string) => {
      const t = ticks[symbolFull];
      if (!t || t.market !== market) return undefined;
      return t;
    },
    [ticks]
  );

  const value = useMemo<UnifiedMarketsPriceContextValue>(
    () => ({
      ticks,
      wsStatus,
      subscribeMarket,
      unsubscribeMarket,
      getTick,
      getTicksForMarket,
      getTickInMarket,
    }),
    [ticks, wsStatus, subscribeMarket, unsubscribeMarket, getTick, getTicksForMarket, getTickInMarket]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUnifiedMarketsPrices(): UnifiedMarketsPriceContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUnifiedMarketsPrices must be used within UnifiedMarketsPriceProvider');
  return ctx;
}

/** @deprecated Use `useUnifiedMarketsPrices` — alias kept for incremental migration. */
export const useMarketPrices = useUnifiedMarketsPrices;

export function useMarketSubscribe(id: MarketId) {
  const { subscribeMarket, unsubscribeMarket } = useUnifiedMarketsPrices();
  useEffect(() => {
    subscribeMarket(id);
    return () => unsubscribeMarket(id);
  }, [id, subscribeMarket, unsubscribeMarket]);
}

export function useTick(symbol: string | undefined | null): UnifiedMarketTick | undefined {
  const { ticks } = useUnifiedMarketsPrices();
  if (!symbol) return undefined;
  return ticks[symbol];
}
