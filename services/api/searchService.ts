import axios from 'axios';

import { FMP_API_V3_BASE, fmpClient } from '@/services/api/fmpClient';

export type SearchVenue = 'FMP' | 'BINANCE' | 'NSE';

export type UnifiedSearchHit = {
  id: string;
  symbol: string;
  name: string;
  venue: SearchVenue;
  /** Emoji flag or token glyph for UI */
  flag: string;
  /** Raw FMP `stockExchange` when venue is FMP (for routing to regional markets). */
  exchange?: string;
};

const BINANCE_INFO = 'https://api.binance.com/api/v3/exchangeInfo';

/** Popular NSE cash symbols for Angel / India autocomplete (expand or replace with live search). */
const NSE_SEED: { symbol: string; name: string }[] = [
  { symbol: 'RELIANCE', name: 'Reliance Industries' },
  { symbol: 'TCS', name: 'Tata Consultancy Services' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank' },
  { symbol: 'INFY', name: 'Infosys' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank' },
  { symbol: 'SBIN', name: 'State Bank of India' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel' },
  { symbol: 'ITC', name: 'ITC' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank' },
  { symbol: 'LT', name: 'Larsen & Toubro' },
  { symbol: 'NIFTY', name: 'Nifty 50 Index' },
  { symbol: 'BANKNIFTY', name: 'Bank Nifty Index' },
];

let binanceSymbolsCache: string[] | null = null;

async function loadBinanceSymbols(): Promise<string[]> {
  if (binanceSymbolsCache) return binanceSymbolsCache;
  const { data } = await axios.get<{ symbols?: { symbol: string }[] }>(BINANCE_INFO, { timeout: 15_000 });
  const list = (data.symbols ?? []).map((s) => s.symbol).filter(Boolean);
  binanceSymbolsCache = list;
  return list;
}

async function searchBinance(query: string, limit: number): Promise<UnifiedSearchHit[]> {
  const q = query.trim().toUpperCase();
  if (q.length < 2) return [];
  try {
    const all = await loadBinanceSymbols();
    const hits = all.filter((s) => s.includes(q)).slice(0, limit);
    return hits.map((symbol) => ({
      id: `BN:${symbol}`,
      symbol,
      name: `${symbol.replace('USDT', '')} / USDT`,
      venue: 'BINANCE' as const,
      flag: '🪙',
    }));
  } catch {
    return [];
  }
}

async function searchFmp(query: string, limit: number): Promise<UnifiedSearchHit[]> {
  const q = query.trim();
  if (q.length < 1) return [];
  const key = fmpClient.readFmpKey();
  if (!key) return [];
  try {
    const { data } = await axios.get<
      { symbol: string; name: string; currency?: string; stockExchange?: string }[]
    >(`${FMP_API_V3_BASE}/search`, {
      params: { query: q, limit, apikey: key },
      timeout: 12_000,
    });
    if (!Array.isArray(data)) return [];
    return data.slice(0, limit).map((row) => {
      const ex = (row.stockExchange ?? '').toUpperCase();
      const flag =
        ex.includes('NASDAQ') || ex.includes('NYSE')
          ? '🇺🇸'
          : ex.includes('LSE')
            ? '🇬🇧'
            : ex.includes('TSX') || ex.includes('TORONTO')
              ? '🇨🇦'
              : ex.includes('XETRA') || ex.includes('FRA')
                ? '🇩🇪'
                : ex.includes('SIX')
                  ? '🇨🇭'
                  : ex.includes('ASX')
                    ? '🇦🇺'
                    : ex.includes('HKEX') || ex.includes('HKG')
                      ? '🇭🇰'
                      : ex.includes('TYO') || ex.includes('JP')
                        ? '🇯🇵'
                        : '🌐';
      return {
        id: `FMP:${row.symbol}`,
        symbol: row.symbol,
        name: row.name ?? row.symbol,
        venue: 'FMP' as const,
        flag,
        exchange: row.stockExchange,
      };
    });
  } catch {
    return [];
  }
}

function searchNseSeed(query: string, limit: number): UnifiedSearchHit[] {
  const q = query.trim().toUpperCase();
  if (q.length < 1) return [];
  return NSE_SEED.filter((r) => r.symbol.includes(q) || r.name.toUpperCase().includes(q))
    .slice(0, limit)
    .map((r) => ({
      id: `NSE:${r.symbol}`,
      symbol: r.symbol,
      name: r.name,
      venue: 'NSE' as const,
      flag: '🇮🇳',
    }));
}

/**
 * Global autocomplete: FMP (global equities), Binance (USDT pairs), NSE seed (Angel universe proxy).
 * De-duplicate by symbol string (FMP wins over Binance on clash).
 */
export async function unifiedSearch(query: string, limitPerSource = 8): Promise<UnifiedSearchHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];

  const [fmp, bn, nse] = await Promise.all([
    searchFmp(trimmed, limitPerSource),
    searchBinance(trimmed, limitPerSource),
    Promise.resolve(searchNseSeed(trimmed, limitPerSource)),
  ]);

  const map = new Map<string, UnifiedSearchHit>();
  for (const h of [...nse, ...bn, ...fmp]) {
    const k = h.symbol.toUpperCase();
    if (!map.has(k)) map.set(k, h);
  }
  return [...map.values()].slice(0, limitPerSource * 2);
}
