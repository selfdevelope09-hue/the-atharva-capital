import type { ActiveMarket } from '@/store/marketStore';
import { useMarketStore } from '@/store/marketStore';
import { DEFAULT_QUOTE_THROTTLE_MS, createThrottledQuoteSink } from '@/utils/performance/throttler';

import { cryptoBinanceTickerStreams } from '@/constants/cryptoMarkets';

import { subscribeBinanceMajorTickers, type BinanceTickerStream } from './binanceClient';
import { webSocketManager } from './webSocketManager';

let binanceHandle: BinanceTickerStream | null = null;
let binanceQuoteSink: ReturnType<typeof createThrottledQuoteSink> | null = null;

function stopBinance() {
  binanceQuoteSink?.flushNow();
  binanceQuoteSink?.cancel();
  binanceQuoteSink = null;
  if (binanceHandle) {
    binanceHandle.disconnect();
    binanceHandle = null;
  }
}

function startBinance() {
  stopBinance();
  const mergeBatch = useMarketStore.getState().mergeLiveQuotesBatch;
  binanceQuoteSink = createThrottledQuoteSink(DEFAULT_QUOTE_THROTTLE_MS, (batch) => {
    mergeBatch(batch);
  });

  binanceHandle = subscribeBinanceMajorTickers(
    cryptoBinanceTickerStreams(),
    (t) => {
      binanceQuoteSink?.push(t.symbol, {
        ltp: t.ltp,
        change24hPct: t.change24hPct,
        source: 'BINANCE',
        high24: t.high24,
        low24: t.low24,
        quoteVolume24h: t.quoteVolume24h,
      });
    },
    () => {
      // Non-fatal: keep last quotes; optional hook for UI error chip later
    }
  );
}

function disconnectAngelStreams() {
  webSocketManager.disconnect();
}

/**
 * Applies feed wiring for the active market. Angel streams are always torn down
 * when leaving INDIA; Binance runs only on CRYPTO.
 */
export function applyMarketStreams(market: ActiveMarket) {
  if (market === 'CRYPTO') {
    disconnectAngelStreams();
    useMarketStore.getState().clearLiveQuotes();
    startBinance();
    return;
  }

  stopBinance();
  disconnectAngelStreams();
  useMarketStore.getState().clearLiveQuotes();

  if (
    market === 'US' ||
    market === 'CHINA' ||
    market === 'JAPAN' ||
    market === 'UK' ||
    market === 'AUSTRALIA' ||
    market === 'GERMANY' ||
    market === 'CANADA' ||
    market === 'SWITZERLAND'
  ) {
    // US: Alpaca WS / REST polling lands here next — `alpacaClient` is ready.
    // Other listed: REST pulls are component-scoped; no global socket yet.
    return;
  }

  // INDIA — SmartAPI socket connects when feed token flow is wired.
}

/**
 * Subscribe to `activeMarket` and swap sockets accordingly.
 * Call once from a root-level `useEffect`.
 */
export function startMarketDataRouter(): () => void {
  let prev = useMarketStore.getState().activeMarket;

  applyMarketStreams(prev);

  const unsub = useMarketStore.subscribe((state) => {
    const next = state.activeMarket;
    if (next === prev) return;
    prev = next;
    applyMarketStreams(next);
  });

  return () => {
    unsub();
    stopBinance();
    disconnectAngelStreams();
  };
}
