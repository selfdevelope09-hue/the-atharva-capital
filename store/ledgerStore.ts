/**
 * Phase 4 — Unified paper ledger: open positions, closed trades, journal hooks, equity snapshots.
 * Balance mutations go through `applyBalanceDelta` (Firestore transaction) + `refreshUser()`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AppMarket } from '@/constants/appMarkets';
import { refreshUser } from '@/services/user/refreshUser';
import { applyBalanceDelta } from '@/services/firebase/userBalancesRepository';
import { auth, isFirebaseConfigured } from '@/config/firebaseConfig';
import { MARKETS, type MarketConfig, toYahooFullSymbol, tvSymbolFor } from '@/src/constants/markets';
import { FEE_DEFAULTS } from '@/src/constants/theme';
import type { OrderFormValue } from '@/src/components/shared/OrderForm';
import { persistLedgerToCloud, loadLedgerFromCloud } from '@/services/firebase/ledgerRepository';
import type { EquityPoint, JournalEntry, LedgerClosedTrade, LedgerOpenPosition } from '@/types/ledger';

export type { EquityPoint, JournalEntry, LedgerClosedTrade, LedgerOpenPosition } from '@/types/ledger';

const STORAGE_KEY = 'atc-ledger-v4';

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function computeLiquidationPrice(p: Pick<LedgerOpenPosition, 'entryPrice' | 'qty' | 'margin' | 'side'>): number {
  const { entryPrice, qty, margin, side } = p;
  if (qty <= 0 || !isFinite(entryPrice)) return entryPrice;
  const delta = margin / qty;
  return side === 'long' ? entryPrice - delta : entryPrice + delta;
}

function grossPnl(side: 'long' | 'short', entry: number, exit: number, qty: number): number {
  return side === 'long' ? (exit - entry) * qty : (entry - exit) * qty;
}

type LedgerState = {
  openPositions: LedgerOpenPosition[];
  closedTrades: LedgerClosedTrade[];
  journalByTradeId: Record<string, JournalEntry>;
  equityCurve: EquityPoint[];
  pendingJournalTrade: LedgerClosedTrade | null;
  /** Hydrate Firestore + merge */
  hydrateFromCloud: () => Promise<void>;
  openFromOrder: (args: {
    market: AppMarket;
    cfg: MarketConfig;
    ticker: string;
    order: OrderFormValue;
    markPrice: number;
  }) => Promise<{ ok: true; position: LedgerOpenPosition } | { ok: false; error: string }>;
  closePosition: (positionId: string, exitPrice: number, reason: 'manual' | 'tp' | 'sl' | 'liquidation') => Promise<void>;
  updateTpSl: (positionId: string, tp: number | null, sl: number | null) => Promise<void>;
  saveJournal: (tradeId: string, entryTags: string[], emotion: string, notes: string) => void;
  dismissJournalPrompt: () => void;
  appendEquitySnapshot: (equityUsd: number) => void;
};

async function syncCloud(state: Pick<LedgerState, 'openPositions' | 'closedTrades' | 'journalByTradeId' | 'equityCurve'>) {
  if (!isFirebaseConfigured || !auth?.currentUser) return;
  try {
    await persistLedgerToCloud(state);
  } catch {
    /* offline */
  }
}

function ledgerPayload(get: () => LedgerState): Pick<LedgerState, 'openPositions' | 'closedTrades' | 'journalByTradeId' | 'equityCurve'> {
  const s = get();
  return {
    openPositions: s.openPositions,
    closedTrades: s.closedTrades,
    journalByTradeId: s.journalByTradeId,
    equityCurve: s.equityCurve,
  };
}

export const useLedgerStore = create<LedgerState>()(
  persist(
    (set, get) => ({
      openPositions: [],
      closedTrades: [],
      journalByTradeId: {},
      equityCurve: [],
      pendingJournalTrade: null,

      hydrateFromCloud: async () => {
        if (!isFirebaseConfigured || !auth?.currentUser) return;
        try {
          const remote = await loadLedgerFromCloud();
          if (!remote) return;
          set((s) => ({
            openPositions: remote.openPositions?.length ? remote.openPositions : s.openPositions,
            closedTrades: remote.closedTrades?.length ? remote.closedTrades : s.closedTrades,
            journalByTradeId: { ...s.journalByTradeId, ...remote.journalByTradeId },
            equityCurve: remote.equityCurve?.length ? remote.equityCurve : s.equityCurve,
          }));
        } catch {
          /* ignore */
        }
      },

      appendEquitySnapshot: (equityUsd) => {
        const ts = Date.now();
        set((s) => ({
          equityCurve: [...s.equityCurve, { ts, equityUsd }].slice(-2000),
        }));
        void syncCloud(ledgerPayload(get));
      },

      openFromOrder: async ({ market, cfg, ticker, order, markPrice }) => {
        const price =
          order.orderType === 'limit' && order.limitPrice != null && order.limitPrice > 0
            ? order.limitPrice
            : markPrice;
        if (!price || price <= 0 || order.amount <= 0) {
          return { ok: false, error: 'Invalid price or size' };
        }
        const feeRate =
          order.feeRole === 'maker' ? cfg.fees?.maker ?? FEE_DEFAULTS.maker : cfg.fees?.taker ?? FEE_DEFAULTS.taker;
        const notional = order.amount * price;
        const margin = order.leverage > 0 ? notional / order.leverage : notional;
        const feeOpen = notional * feeRate;
        const totalCost = margin + feeOpen;

        const { useMultiMarketBalanceStore } = await import('@/store/multiMarketBalanceStore');
        const bal = useMultiMarketBalanceStore.getState().balances[market] ?? 0;
        if (bal < totalCost) {
          return { ok: false, error: 'Insufficient balance for margin + fees' };
        }

        const sync = isFirebaseConfigured && !!auth?.currentUser;
        try {
          if (sync) {
            await applyBalanceDelta(market, -totalCost);
            await useMultiMarketBalanceStore.getState().hydrateFromCloud();
          } else {
            await useMultiMarketBalanceStore.getState().applyDelta(market, -totalCost, false);
          }
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'Balance update failed' };
        }

        const symbolFull =
          cfg.dataSource === 'binance_websocket' ? ticker : toYahooFullSymbol(cfg, ticker);
        const pos: LedgerOpenPosition = {
          id: id('pos'),
          market,
          symbol: ticker.toUpperCase(),
          symbolFull,
          tvSymbol: tvSymbolFor(cfg, ticker),
          side: order.side,
          entryPrice: price,
          qty: order.amount,
          leverage: Math.max(1, order.leverage),
          margin,
          feeOpen,
          tp: order.tp,
          sl: order.sl,
          openedAt: new Date().toISOString(),
          currencySymbol: cfg.currencySymbol,
        };

        set((s) => ({ openPositions: [pos, ...s.openPositions] }));
        void syncCloud(ledgerPayload(get));
        void refreshUser().catch(() => {});
        return { ok: true, position: pos };
      },

      closePosition: async (positionId, exitPrice, reason) => {
        const pos = get().openPositions.find((p) => p.id === positionId);
        if (!pos) return;
        const cfg = MARKETS[pos.market];
        const feeRate = cfg.fees?.taker ?? FEE_DEFAULTS.taker;
        const notional = exitPrice * pos.qty;
        const feeClose = notional * feeRate;
        const g = grossPnl(pos.side, pos.entryPrice, exitPrice, pos.qty);
        const realized = g - pos.feeOpen - feeClose;
        const win = realized > 0;

        const opened = new Date(pos.openedAt).getTime();
        const holdMinutes = Math.max(0, Math.round((Date.now() - opened) / 60000));

        const closed: LedgerClosedTrade = {
          id: id('cls'),
          positionId: pos.id,
          market: pos.market,
          symbol: pos.symbol,
          side: pos.side,
          entryPrice: pos.entryPrice,
          exitPrice,
          qty: pos.qty,
          realizedPnl: realized,
          feeOpen: pos.feeOpen,
          feeClose,
          closedAt: new Date().toISOString(),
          holdMinutes,
          win,
          wasTpHit: reason === 'tp',
          wasSlHit: reason === 'sl' || reason === 'liquidation',
        };

        const sync = isFirebaseConfigured && !!auth?.currentUser;
        const credit = pos.margin + g - feeClose;
        try {
          if (sync) {
            await applyBalanceDelta(pos.market, credit);
            const { useMultiMarketBalanceStore } = await import('@/store/multiMarketBalanceStore');
            await useMultiMarketBalanceStore.getState().hydrateFromCloud();
          } else {
            const { useMultiMarketBalanceStore } = await import('@/store/multiMarketBalanceStore');
            await useMultiMarketBalanceStore.getState().applyDelta(pos.market, credit, false);
          }
        } catch {
          return;
        }

        set((s) => ({
          openPositions: s.openPositions.filter((p) => p.id !== positionId),
          closedTrades: [closed, ...s.closedTrades].slice(0, 2000),
          pendingJournalTrade: closed,
        }));
        void syncCloud(ledgerPayload(get));
        void refreshUser().catch(() => {});
        void import('@/store/interstitialUiStore').then((m) => {
          m.useInterstitialUiStore.getState().show('position_close');
        });
      },

      updateTpSl: async (positionId, tp, sl) => {
        set((s) => ({
          openPositions: s.openPositions.map((p) => (p.id === positionId ? { ...p, tp, sl } : p)),
        }));
        void syncCloud(ledgerPayload(get));
      },

      saveJournal: (tradeId, entryTags, emotion, notes) => {
        const entry: JournalEntry = {
          tradeId,
          entryTags,
          emotion,
          notes,
          savedAt: new Date().toISOString(),
        };
        set((s) => ({
          journalByTradeId: { ...s.journalByTradeId, [tradeId]: entry },
          pendingJournalTrade: s.pendingJournalTrade?.id === tradeId ? null : s.pendingJournalTrade,
        }));
        void syncCloud(ledgerPayload(get));
      },

      dismissJournalPrompt: () => set({ pendingJournalTrade: null }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        openPositions: s.openPositions,
        closedTrades: s.closedTrades,
        journalByTradeId: s.journalByTradeId,
        equityCurve: s.equityCurve,
      }),
    }
  )
);
