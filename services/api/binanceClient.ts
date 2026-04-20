/**
 * Binance combined WebSocket stream — public ticker channels (no API keys).
 * @see https://binance-docs.github.io/apidocs/spot/en/#individual-symbol-ticker-streams
 */

export const BINANCE_WS_COMBINED = 'wss://stream.binance.com:9443/stream';

export const DEFAULT_MAJOR_TICKER_STREAMS = ['btcusdt@ticker', 'ethusdt@ticker', 'solusdt@ticker'] as const;

export type BinanceTickerUpdate = {
  /** e.g. BTCUSDT */
  symbol: string;
  ltp: number;
  change24hPct: number;
  high24?: number;
  low24?: number;
  /** Quote-asset volume (USDT) for 24h window when present. */
  quoteVolume24h?: number;
};

type CombinedEnvelope = {
  stream?: string;
  data?: {
    e?: string;
    s?: string;
    c?: string;
    P?: string;
    h?: string;
    l?: string;
    q?: string;
  };
};

function parseCombinedTicker(raw: unknown): BinanceTickerUpdate | null {
  if (!raw || typeof raw !== 'object') return null;
  const msg = raw as CombinedEnvelope;
  const d = msg.data;
  if (!d || d.e !== '24hrTicker') return null;
  if (!d.s || !d.c || d.P === undefined) return null;
  const ltp = Number(d.c);
  const change24hPct = Number(d.P);
  if (!Number.isFinite(ltp) || !Number.isFinite(change24hPct)) return null;
  const high24 = d.h !== undefined ? Number(d.h) : undefined;
  const low24 = d.l !== undefined ? Number(d.l) : undefined;
  const quoteVolume24h = d.q !== undefined ? Number(d.q) : undefined;
  return {
    symbol: d.s,
    ltp,
    change24hPct,
    ...(Number.isFinite(high24) ? { high24: high24! } : {}),
    ...(Number.isFinite(low24) ? { low24: low24! } : {}),
    ...(Number.isFinite(quoteVolume24h) ? { quoteVolume24h: quoteVolume24h! } : {}),
  };
}

export type BinanceTickerStream = {
  disconnect: () => void;
};

/**
 * Subscribe to one or more `@ticker` streams on a single socket.
 * Invokes `onTicker` for each parsed 24h ticker event.
 */
export function subscribeBinanceMajorTickers(
  streams: string[],
  onTicker: (t: BinanceTickerUpdate) => void,
  onError?: (e: unknown) => void
): BinanceTickerStream {
  const query = streams.join('/');
  const url = `${BINANCE_WS_COMBINED}?streams=${query}`;

  const ws = new WebSocket(url);

  ws.onmessage = (event) => {
    try {
      const parsed = JSON.parse(String(event.data)) as unknown;
      const tick = parseCombinedTicker(parsed);
      if (tick) onTicker(tick);
    } catch (e) {
      onError?.(e);
    }
  };

  ws.onerror = (e) => onError?.(e);

  return {
    disconnect: () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
    },
  };
}
