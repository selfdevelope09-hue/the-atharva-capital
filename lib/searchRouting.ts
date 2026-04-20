import type { ActiveMarket } from '@/store/marketStore';
import type { UnifiedSearchHit } from '@/services/api/searchService';

/** Route a unified search hit to the closest active market tab. */
export function activeMarketFromSearchHit(hit: UnifiedSearchHit): ActiveMarket {
  if (hit.venue === 'NSE') return 'INDIA';
  if (hit.venue === 'BINANCE') return 'CRYPTO';
  const ex = (hit.exchange ?? '').toUpperCase();
  if (ex.includes('NSE') || ex.includes('BSE')) return 'INDIA';
  if (ex.includes('HKEX') || ex.includes('HKG') || ex.includes('SHANGHAI') || ex.includes('SHENZHEN')) return 'CHINA';
  if (ex.includes('TYO') || ex.includes('TOKYO')) return 'JAPAN';
  if (ex.includes('LSE')) return 'UK';
  if (ex.includes('ASX')) return 'AUSTRALIA';
  if (ex.includes('XETRA') || ex.includes('FRA')) return 'GERMANY';
  if (ex.includes('TSX') || ex.includes('TORONTO')) return 'CANADA';
  if (ex.includes('SIX')) return 'SWITZERLAND';
  return 'US';
}
