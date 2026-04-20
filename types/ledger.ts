import type { AppMarket } from '@/constants/appMarkets';

export type LedgerOpenPosition = {
  id: string;
  market: AppMarket;
  symbol: string;
  symbolFull: string;
  tvSymbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  qty: number;
  leverage: number;
  margin: number;
  feeOpen: number;
  tp: number | null;
  sl: number | null;
  openedAt: string;
  currencySymbol: string;
};

export type LedgerClosedTrade = {
  id: string;
  positionId: string;
  market: AppMarket;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  qty: number;
  realizedPnl: number;
  feeOpen: number;
  feeClose: number;
  closedAt: string;
  holdMinutes: number;
  win: boolean;
  wasTpHit: boolean;
  wasSlHit: boolean;
};

export type JournalEntry = {
  tradeId: string;
  entryTags: string[];
  emotion: string;
  notes: string;
  savedAt: string;
};

export type EquityPoint = { ts: number; equityUsd: number };
