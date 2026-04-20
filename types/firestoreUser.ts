/**
 * Phase 1 — Firestore document shapes for `users/{uid}` and nested collections.
 * UI layers must not invent fields outside these types (extend here first).
 */

import type { AppMarket } from '@/constants/appMarkets';

/** ISO currency codes for Frankfurter / display. */
export type FiatCurrencyCode =
  | 'USD'
  | 'INR'
  | 'GBP'
  | 'CNY'
  | 'JPY'
  | 'AUD'
  | 'EUR'
  | 'CAD'
  | 'CHF';

export type UserBalances = Record<AppMarket, number>;

export type PositionStatus = 'open' | 'closed' | 'liquidated';

export type UserPosition = {
  id: string;
  market: AppMarket;
  symbol: string;
  type: 'long' | 'short';
  entryPrice: number;
  leverage: number;
  margin: number;
  totalSize: number;
  currency: FiatCurrencyCode | 'USDT';
  currencySymbol: string;
  fee: number;
  feeType: 'maker' | 'taker';
  tp: number | null;
  sl: number | null;
  status: PositionStatus;
  time: string;
  notes?: string;
  tradeTag?: string;
  emotionTag?: string;
};

export type ClosedPosition = UserPosition & {
  exitPrice: number;
  realizedPnl: number;
  realizedPnlUSD: number;
  closedAt: string;
  holdTimeMinutes: number;
  wasTPHit: boolean;
  wasSLHit: boolean;
};

export type WatchlistDocument = {
  id: string;
  name: string;
  market: AppMarket;
  symbols: string[];
  createdAt: string;
  color: string;
};

/** Nested: users/{uid}/watchlists/{market}/{watchlistId} — use map keyed by watchlistId in Firestore. */
export type WatchlistsByMarket = Record<AppMarket, Record<string, WatchlistDocument>>;

export type PriceAlert = {
  id: string;
  market: AppMarket;
  symbol: string;
  price: number;
  condition: 'above' | 'below' | 'pct_change';
  /** once | every | daily */
  type: string;
  active: boolean;
  createdAt: string;
  triggeredAt?: string;
};

export type ChallengeProgress = Record<string, number>;

export type UserProfileRoot = {
  uid: string;
  email?: string;
  name?: string;
  avatarColor?: string;
  level?: number;
  xp?: number;
  joinedAt?: string;
  balances?: Partial<UserBalances>;
  positions?: UserPosition[];
  closedPositions?: ClosedPosition[];
  watchlists?: WatchlistsByMarket;
  alerts?: PriceAlert[];
  rivals?: string[];
  achievements?: string[];
  challengeProgress?: ChallengeProgress;
  /** Legacy leaderboard sync — keep until migrated. */
  totalNetWorth?: number;
};
