import { Platform } from 'react-native';

// Yahoo Finance v8 chart endpoint does NOT set CORS headers, so on web we
// route through a proxy. Override this via env/config in prod.
//   - Native (iOS/Android): no proxy needed; we hit Yahoo directly.
//   - Web: proxy required. Default is corsproxy.io; swap for your backend.
export const YAHOO_PROXY_BASE = 'https://corsproxy.io/?';
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';

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

function buildUrl(fullSymbol: string): string {
  const raw = `${YAHOO_BASE}${encodeURIComponent(fullSymbol)}?interval=1d&range=1d`;
  if (Platform.OS === 'web') return `${YAHOO_PROXY_BASE}${encodeURIComponent(raw)}`;
  return raw;
}

export async function fetchYahooQuote(fullSymbol: string, signal?: AbortSignal): Promise<YahooQuote | null> {
  try {
    const res = await fetch(buildUrl(fullSymbol), { signal });
    if (!res.ok) return null;
    const json = await res.json();
    const r = json?.chart?.result?.[0];
    const meta = r?.meta;
    if (!meta) return null;
    return {
      symbol: fullSymbol,
      price: num(meta.regularMarketPrice),
      open: num(meta.regularMarketOpen ?? meta.chartPreviousClose),
      high: num(meta.regularMarketDayHigh),
      low: num(meta.regularMarketDayLow),
      volume: num(meta.regularMarketVolume),
      marketState: meta.marketState ?? null,
      preMarketPrice: num(meta.preMarketPrice),
      postMarketPrice: num(meta.postMarketPrice),
      prevClose: num(meta.chartPreviousClose ?? meta.previousClose),
      fiftyTwoWeekHigh: num(meta.fiftyTwoWeekHigh ?? meta.regularMarketDayHigh),
      fiftyTwoWeekLow: num(meta.fiftyTwoWeekLow ?? meta.regularMarketDayLow),
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
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
