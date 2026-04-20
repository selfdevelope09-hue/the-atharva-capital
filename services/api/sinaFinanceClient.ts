/**
 * Sina Finance HQ quotes (plain text / CSV-in-string).
 * @see https://finance.sina.com.cn (legacy `hq.sinajs.cn` API)
 *
 * Note: Responses are often GBK-encoded; this scaffold reads UTF-8 and may
 * mangle Chinese names until a binary decode is added. Numeric fields still parse.
 * Web clients may hit CORS / mixed-content — use a proxy in production or fetch from native.
 *
 * Fallback: Financial Modeling Prep (`EXPO_PUBLIC_FMP_API_KEY`) can be wired in `fetchQuoteWithFallback`.
 */

export const SINA_HQ_URL = 'http://hq.sinajs.cn';

export type SinaParsedQuote = {
  sinaKey: string;
  name: string;
  open: number;
  prevClose: number;
  last: number;
  high: number;
  low: number;
};

/** Regex: var hq_str_sh600519="...."; */
const VAR_RE = /var\s+hq_str_([^=]+)="([^"]*)";/g;

/**
 * Parse the entire `hq.sinajs.cn` response body into a map keyed by Sina list token
 * (e.g. `sh600519`, `hk00700`).
 */
export function parseSinaHqJsBody(body: string): Record<string, SinaParsedQuote> {
  const out: Record<string, SinaParsedQuote> = {};
  for (const m of body.matchAll(VAR_RE)) {
    const sinaKey = m[1]?.trim();
    const inner = m[2];
    if (!sinaKey || inner === '') continue;
    const parsed = parseSinaCsvFields(sinaKey, inner);
    if (parsed) out[sinaKey] = parsed;
  }
  return out;
}

/**
 * Sina CSV layout (typical A-share / HK spot):
 * 0 name, 1 open, 2 prev_close, 3 last, 4 high, 5 low, ...
 * Field counts vary slightly by venue; we require at least 6 fields for LTP band.
 */
export function parseSinaCsvFields(sinaKey: string, csv: string): SinaParsedQuote | null {
  const fields = csv.split(',');
  if (fields.length < 6) return null;
  const name = fields[0]?.trim() ?? '';
  const open = Number(fields[1]);
  const prevClose = Number(fields[2]);
  const last = Number(fields[3]);
  const high = Number(fields[4]);
  const low = Number(fields[5]);
  if (![open, prevClose, last, high, low].every((n) => Number.isFinite(n))) return null;
  return { sinaKey, name, open, prevClose, last, high, low };
}

export function changePctFromSina(q: SinaParsedQuote): number {
  if (!q.prevClose) return 0;
  return ((q.last - q.prevClose) / q.prevClose) * 100;
}

export type FetchSinaOptions = {
  /** Sina list codes, e.g. `['hk00700','hk09988','sh600519','sz002594']` */
  list: string[];
  signal?: AbortSignal;
};

export async function fetchSinaQuotes({ list, signal }: FetchSinaOptions): Promise<Record<string, SinaParsedQuote>> {
  const q = encodeURIComponent(list.join(','));
  const url = `${SINA_HQ_URL}/list=${q}`;
  const res = await fetch(url, {
    method: 'GET',
    signal,
    headers: {
      /** Sina often expects a browser referer */
      Referer: 'https://finance.sina.com.cn/',
    },
  });
  if (!res.ok) {
    throw new Error(`Sina HQ HTTP ${res.status}`);
  }
  const text = await res.text();
  return parseSinaHqJsBody(text);
}

const FMP_BASE = 'https://financialmodelingprep.com/api/v3';

/**
 * Optional FMP quote fallback (requires `EXPO_PUBLIC_FMP_API_KEY` in env).
 * Returns null if key missing or request fails — caller should use mocks.
 */
export async function fetchFmpQuoteFallback(symbol: string): Promise<{ last: number; changePct: number } | null> {
  const key = process.env.EXPO_PUBLIC_FMP_API_KEY;
  if (!key) return null;
  try {
    const url = `${FMP_BASE}/quote-short/${encodeURIComponent(symbol)}?apikey=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { price?: number; changesPercentage?: number }[];
    const row = Array.isArray(data) ? data[0] : null;
    if (!row || typeof row.price !== 'number') return null;
    return { last: row.price, changePct: Number(row.changesPercentage ?? 0) };
  } catch {
    return null;
  }
}

export const sinaFinanceClient = {
  SINA_HQ_URL,
  parseSinaHqJsBody,
  parseSinaCsvFields,
  changePctFromSina,
  fetchSinaQuotes,
  fetchFmpQuoteFallback,
};
