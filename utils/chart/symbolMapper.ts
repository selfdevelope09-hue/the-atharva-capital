import type { ActiveMarket } from '@/store/marketStore';

export type TradingViewSymbol = string;

function cleanTicker(raw?: string | null): string {
  if (!raw) return '';
  return String(raw).trim().toUpperCase().replace(/\s+/g, '');
}

/** Default chart symbol per venue (no exchange prefix). */
export function defaultSymbolForMarket(market: ActiveMarket): string {
  switch (market) {
    case 'INDIA':
      return 'RELIANCE';
    case 'US':
      return 'AAPL';
    case 'CRYPTO':
      return 'BTCUSDT';
    case 'UK':
      return 'BARC';
    case 'CHINA':
      return '600519';
    case 'JAPAN':
      return '7203';
    case 'AUSTRALIA':
      return 'CBA';
    case 'GERMANY':
      return 'SAP';
    case 'CANADA':
      return 'SHOP';
    case 'SWITZERLAND':
      return 'NESN';
    default:
      return 'AAPL';
  }
}

function stripSuffix(ticker: string, suffix: string): string {
  if (!suffix) return ticker.toUpperCase();
  const up = ticker.toUpperCase();
  const suf = suffix.toUpperCase();
  return up.endsWith(suf) ? up.slice(0, -suf.length) : up;
}

/**
 * Map internal `(market, ticker)` to TradingView `EXCHANGE:SYMBOL`.
 * Tickers may include Yahoo-style suffixes (e.g. `.NS`); those are stripped before prefixing.
 */
export function mapToTradingViewSymbol(market: ActiveMarket, rawTicker?: string | null): TradingViewSymbol {
  const t0 = cleanTicker(rawTicker);
  const fallback = defaultSymbolForMarket(market);
  const base = t0 || fallback;

  switch (market) {
    case 'INDIA':
      return `NSE:${stripSuffix(base, '.NS')}`;
    case 'US':
      return `NASDAQ:${base}`;
    case 'CRYPTO': {
      const sym = stripSuffix(base, 'USDT');
      return base.endsWith('USDT') ? `BINANCE:${base}` : `BINANCE:${sym}USDT`;
    }
    case 'UK':
      return `LSE:${stripSuffix(base, '.L')}`;
    case 'CHINA':
      return `SSE:${stripSuffix(base, '.SS')}`;
    case 'JAPAN':
      return `TSE:${stripSuffix(base, '.T')}`;
    case 'AUSTRALIA':
      return `ASX:${stripSuffix(base, '.AX')}`;
    case 'GERMANY':
      // TradingView uses XETR for Xetra listings.
      return `XETR:${stripSuffix(base, '.DE')}`;
    case 'CANADA':
      return `TSX:${stripSuffix(base, '.TO')}`;
    case 'SWITZERLAND':
      return `SIX:${stripSuffix(base, '.SW')}`;
    default:
      return `NASDAQ:${fallback}`;
  }
}

export function tradingViewLocaleForMarket(market: ActiveMarket): string {
  switch (market) {
    case 'JAPAN':
      return 'ja';
    case 'CHINA':
      return 'zh';
    case 'GERMANY':
      return 'de';
    default:
      return 'en';
  }
}

export function tradingViewTimezoneForMarket(market: ActiveMarket): string {
  switch (market) {
    case 'INDIA':
      return 'Asia/Kolkata';
    case 'US':
      return 'America/New_York';
    case 'UK':
      return 'Europe/London';
    case 'CHINA':
      return 'Asia/Shanghai';
    case 'JAPAN':
      return 'Asia/Tokyo';
    case 'AUSTRALIA':
      return 'Australia/Sydney';
    case 'GERMANY':
      return 'Europe/Berlin';
    case 'CANADA':
      return 'America/Toronto';
    case 'SWITZERLAND':
      return 'Europe/Zurich';
    case 'CRYPTO':
    default:
      return 'Etc/UTC';
  }
}
