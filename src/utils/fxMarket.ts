import type { AppMarket } from '@/constants/appMarkets';

/** Frankfurter quote currency per virtual market sleeve. */
export const APP_MARKET_FIAT: Record<AppMarket, string> = {
  crypto: 'USD',
  india: 'INR',
  usa: 'USD',
  uk: 'GBP',
  china: 'CNY',
  japan: 'JPY',
  australia: 'AUD',
  germany: 'EUR',
  canada: 'CAD',
  switzerland: 'CHF',
};
