import { Platform } from 'react-native';

// CORS proxies tried in order. First success wins.
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://thingproxy.freeboard.io/fetch/',
];

// Track which proxy index is currently working to avoid redundant retries
let _activeProxyIdx = 0;

/** @deprecated Use fetchYahooQuote which handles proxies automatically */
export const YAHOO_PROXY_BASE = CORS_PROXIES[0];

export interface YahooQuote {
  symbol: string;
  price: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  marketState: string | null;
  preMarketPrice: number | null;
  postMarketPrice: number | null;
  prevClose: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fetchedAt: number;
}

function buildUrl(fullSymbol: string, proxyIdx = 0): string {
  const raw = `${YAHOO_BASE}${encodeURIComponent(fullSymbol)}?interval=1d&range=1d`;
  if (Platform.OS !== 'web') return raw;
  return `${CORS_PROXIES[proxyIdx]}${encodeURIComponent(raw)}`;
}

function parseYahooResponse(json: unknown, fullSymbol: string): YahooQuote | null {
  const r = (json as Record<string, unknown>)?.['chart'] as Record<string, unknown>;
  const result = (r?.['result'] as unknown[])?.[0] as Record<string, unknown> | undefined;
  const meta = result?.['meta'] as Record<string, unknown> | undefined;
  if (!meta) return null;
  return {
    symbol: fullSymbol,
    price: num(meta['regularMarketPrice']),
    open: num(meta['regularMarketOpen'] ?? meta['chartPreviousClose']),
    high: num(meta['regularMarketDayHigh']),
    low: num(meta['regularMarketDayLow']),
    volume: num(meta['regularMarketVolume']),
    marketState: typeof meta['marketState'] === 'string' ? meta['marketState'] : null,
    preMarketPrice: num(meta['preMarketPrice']),
    postMarketPrice: num(meta['postMarketPrice']),
    prevClose: num(meta['chartPreviousClose'] ?? meta['previousClose']),
    fiftyTwoWeekHigh: num(meta['fiftyTwoWeekHigh'] ?? meta['regularMarketDayHigh']),
    fiftyTwoWeekLow: num(meta['fiftyTwoWeekLow'] ?? meta['regularMarketDayLow']),
    fetchedAt: Date.now(),
  };
}

export async function fetchYahooQuote(fullSymbol: string, signal?: AbortSignal): Promise<YahooQuote | null> {
  if (Platform.OS !== 'web') {
    // Native: direct request, no proxy needed
    try {
      const res = await fetch(buildUrl(fullSymbol), { signal });
      if (!res.ok) return null;
      return parseYahooResponse(await res.json(), fullSymbol);
    } catch { return null; }
  }

  // Web: try each proxy starting from the last known-good one
  const start = _activeProxyIdx;
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const idx = (start + i) % CORS_PROXIES.length;
    if (signal?.aborted) return null;
    try {
      const res = await fetch(buildUrl(fullSymbol, idx), {
        signal,
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) continue;
      const json = await res.json();
      const q = parseYahooResponse(json, fullSymbol);
      if (q) {
        _activeProxyIdx = idx; // remember the working proxy
        return q;
      }
    } catch {
      // try next proxy
    }
  }
  return null;
}

const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchYahooBatch(fullSymbols: string[], signal?: AbortSignal): Promise<Record<string, YahooQuote>> {
  const out: Record<string, YahooQuote> = {};
  const failed: string[] = [];

  for (let i = 0; i < fullSymbols.length; i += BATCH_SIZE) {
    if (signal?.aborted) break;
    const batch = fullSymbols.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((s) => fetchYahooQuote(s, signal)));
    results.forEach((r, j) => {
      if (r.status === 'fulfilled' && r.value) {
        out[batch[j]] = r.value;
      } else {
        failed.push(batch[j]);
      }
    });
    if (i + BATCH_SIZE < fullSymbols.length && !signal?.aborted) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  // Retry failed symbols once
  if (failed.length > 0 && !signal?.aborted) {
    await sleep(BATCH_DELAY_MS);
    const retries = await Promise.allSettled(failed.map((s) => fetchYahooQuote(s, signal)));
    retries.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) out[failed[i]] = r.value;
    });
  }

  return out;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return isFinite(n) ? n : null;
  }
  return null;
}
