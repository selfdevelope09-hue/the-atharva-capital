/**
 * Phase 1 — Canonical market keys for isolation, balances, and Firestore.
 * Aligns with `src/constants/markets.ts` `MarketId`.
 */
import type { MarketId } from '@/src/constants/markets';

export type AppMarket = MarketId;

export const ALL_APP_MARKETS: AppMarket[] = [
  'crypto',
  'india',
  'usa',
  'uk',
  'china',
  'japan',
  'australia',
  'germany',
  'canada',
  'switzerland',
];

/** Starting virtual balance per market (local currency / USDT for crypto). */
export const STARTING_BALANCES: Record<AppMarket, number> = {
  crypto: 10_000,
  india: 800_000,
  usa: 10_000,
  uk: 8000,
  china: 72_000,
  japan: 1_500_000,
  australia: 15_000,
  germany: 9200,
  canada: 13_500,
  switzerland: 9000,
};

/** Default top-up amount (same numeric cap as spec: “10,000 of that currency”). */
export const TOP_UP_AMOUNT: Record<AppMarket, number> = {
  crypto: 10_000,
  india: 10_000,
  usa: 10_000,
  uk: 10_000,
  china: 10_000,
  japan: 10_000,
  australia: 10_000,
  germany: 10_000,
  canada: 10_000,
  switzerland: 10_000,
};

export function isAppMarket(v: string): v is AppMarket {
  return (ALL_APP_MARKETS as string[]).includes(v);
}
