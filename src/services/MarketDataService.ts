/**
 * MarketDataService — canonical live-price layer for all 9 markets + crypto.
 *
 * Crypto:   Binance WebSocket via UnifiedMarketsPriceContext (real-time).
 * Equities: Yahoo Finance v8 chart API polled every 15 s (no API key required).
 *           On web a CORS proxy is automatically applied (see yahooFinance.ts).
 *
 * The full symbol lists below match src/constants/markets.ts exactly so that
 * symbol keys are interchangeable with UnifiedMarketsTick keys.
 */

import {
  fetchYahooBatch,
  fetchYahooQuote,
  type YahooQuote,
} from '@/src/services/yahooFinance';

export { type YahooQuote };

// ── All Yahoo symbols, grouped by market ─────────────────────────────────────
export const MARKET_SYMBOLS = {
  india: [
    'RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'ICICIBANK.NS',
    'WIPRO.NS', 'BAJFINANCE.NS', 'SBIN.NS', 'ITC.NS', 'ADANIENT.NS',
    '^NSEI', '^BSESN', 'NIFTYBEES.NS', 'BANKBEES.NS',
  ],
  usa: [
    'AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX',
    'AMD', 'COIN',
    '^GSPC', '^IXIC', '^DJI', '^VIX',
  ],
  uk: [
    'BARC.L', 'HSBA.L', 'BP.L', 'SHEL.L', 'AZN.L', 'ULVR.L', 'GSK.L',
    'LLOY.L', 'VOD.L', 'RIO.L', '^FTSE',
  ],
  china: [
    '600519.SS', '601318.SS', '600036.SS', '600900.SS', '000858.SZ',
    '002594.SZ', '300750.SZ', '000001.SS', '^HSI',
  ],
  japan: [
    '7203.T', '9984.T', '6758.T', '8306.T', '7267.T',
    '9432.T', '6501.T', '4063.T', '^N225',
  ],
  australia: [
    'CBA.AX', 'BHP.AX', 'CSL.AX', 'NAB.AX', 'WBC.AX', 'ANZ.AX',
    'WES.AX', 'TLS.AX', 'FMG.AX', '^AXJO',
  ],
  germany: [
    'SAP.DE', 'SIE.DE', 'ALV.DE', 'BAS.DE', 'BMW.DE', 'MBG.DE',
    'VOW3.DE', 'DTE.DE', 'ADS.DE', '^GDAXI',
  ],
  canada: [
    'SHOP.TO', 'RY.TO', 'TD.TO', 'ENB.TO', 'CNR.TO',
    'BMO.TO', 'SU.TO', 'MFC.TO', 'BCE.TO', '^GSPTSE',
  ],
  switzerland: [
    'NESN.SW', 'ROG.SW', 'NOVN.SW', 'ABB.SW', 'UHR.SW',
    'ZURN.SW', 'UBSG.SW', 'GEBN.SW', '^SSMI',
  ],
  crypto: [
    'BTC-USD', 'ETH-USD', 'BNB-USD', 'SOL-USD',
    'XRP-USD', 'DOGE-USD', 'ADA-USD', 'AVAX-USD',
  ],
} as const;

export type MarketKey = keyof typeof MARKET_SYMBOLS;

// ── Currency helpers ──────────────────────────────────────────────────────────
const CURRENCY_SYMBOLS: Record<string, string> = {
  india: '₹', usa: '$', uk: '£', china: '¥', japan: '¥',
  australia: 'A$', germany: '€', canada: 'C$', switzerland: 'Fr.',
  crypto: '$',
};

export function getCurrencySymbol(market: string): string {
  return CURRENCY_SYMBOLS[market] ?? '$';
}

// ── Market-state badge helper ─────────────────────────────────────────────────
export type MarketBadge = { label: string; color: string };

export function getMarketBadge(marketState: string | null | undefined): MarketBadge {
  switch (marketState) {
    case 'REGULAR': return { label: '🟢 OPEN',         color: '#00C805' };
    case 'PRE':     return { label: '🟡 PRE-MARKET',   color: '#f0b90b' };
    case 'POST':    return { label: '🟠 AFTER-HOURS',  color: '#ff8c00' };
    case 'CLOSED':  return { label: '🔴 CLOSED',       color: '#c0392b' };
    default:        return { label: '⚪ —',            color: '#7b8390' };
  }
}

// ── Change-percent helper (works for any YahooQuote) ─────────────────────────
export function calcChangePct(q: YahooQuote | undefined, fallback = 0): number {
  if (!q || q.price == null || q.prevClose == null || q.prevClose === 0) return fallback;
  return ((q.price - q.prevClose) / q.prevClose) * 100;
}

// ── Fetch wrappers (thin re-exports) ─────────────────────────────────────────

/** Fetch a single Yahoo symbol. Returns null on network/parse error. */
export async function fetchQuote(symbol: string): Promise<YahooQuote | null> {
  return fetchYahooQuote(symbol);
}

/**
 * Fetch all symbols for a market in parallel (batches of 5, 500 ms apart).
 * Returns a map of symbol → YahooQuote.
 */
export async function fetchMarketQuotes(
  market: MarketKey,
): Promise<Record<string, YahooQuote>> {
  const symbols = [...MARKET_SYMBOLS[market]];
  const out: Record<string, YahooQuote> = {};
  const BATCH = 5;
  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const res = await fetchYahooBatch(batch);
    Object.assign(out, res);
    if (i + BATCH < symbols.length) {
      await new Promise<void>((r) => setTimeout(r, 500));
    }
  }
  return out;
}
