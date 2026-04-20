import { create } from 'zustand';

import { CRYPTO_TAKER_FEE_RATE, CRYPTO_MAKER_FEE_RATE } from '@/store/cryptoMarginStore';

export type CryptoPaperSide = 'LONG' | 'SHORT';

export type CryptoPaperPosition = {
  id: string;
  symbol: string;
  side: CryptoPaperSide;
  entryPrice: number;
  leverage: number;
  margin: number;
  totalSize: number;
  fee: number;
  feeType: 'maker' | 'taker';
  tp: number | null;
  sl: number | null;
  openedAt: string;
};

export type CryptoPaperClosed = CryptoPaperPosition & {
  exitPrice: number;
  realizedPnl: number;
  closedAt: string;
};

type PaperState = {
  /** Isolated paper USDT wallet for crypto futures simulation (not mixed with venue FX wallet). */
  paperUsdt: number;
  positions: CryptoPaperPosition[];
  closed: CryptoPaperClosed[];

  openFromTicket: (args: {
    symbol: string;
    side: CryptoPaperSide;
    markPrice: number;
    notionalUsdt: number;
    leverage: number;
    feeType: 'maker' | 'taker';
    tp: number | null;
    sl: number | null;
  }) => { ok: true; id: string } | { ok: false; error: string };

  closeById: (id: string, markPrice: number) => { ok: true; pnl: number } | { ok: false; error: string };

  reset: () => void;
};

const START = 10_000;

function id(): string {
  return `pp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function pnlAtMark(pos: CryptoPaperPosition, mark: number): number {
  const e = pos.entryPrice;
  if (e <= 0 || mark <= 0) return 0;
  const move = pos.side === 'LONG' ? mark - e : e - mark;
  return (move / e) * pos.totalSize;
}

export const useCryptoPaperStore = create<PaperState>((set, get) => ({
  paperUsdt: START,
  positions: [],
  closed: [],

  openFromTicket: (args) => {
    const { symbol, side, markPrice, notionalUsdt, leverage, feeType, tp, sl } = args;
    if (!Number.isFinite(notionalUsdt) || notionalUsdt <= 0) {
      return { ok: false, error: 'Enter a valid size (USDT).' };
    }
    if (!Number.isFinite(markPrice) || markPrice <= 0) {
      return { ok: false, error: 'Waiting for live mark price…' };
    }
    const L = Math.max(1, Math.round(leverage));
    const rate = feeType === 'maker' ? CRYPTO_MAKER_FEE_RATE : CRYPTO_TAKER_FEE_RATE;
    const fee = notionalUsdt * rate;
    const margin = notionalUsdt / L;
    const totalCost = margin + fee;
    const bal = get().paperUsdt;
    if (totalCost > bal + 1e-6) {
      return {
        ok: false,
        error: `Need $${totalCost.toFixed(2)} (margin + fee). Available $${bal.toFixed(2)}.`,
      };
    }
    const openedAt = new Date().toISOString();
    const pos: CryptoPaperPosition = {
      id: id(),
      symbol: symbol.toUpperCase(),
      side,
      entryPrice: markPrice,
      leverage: L,
      margin,
      totalSize: notionalUsdt,
      fee,
      feeType,
      tp,
      sl,
      openedAt,
    };
    set((s) => ({
      paperUsdt: s.paperUsdt - totalCost,
      positions: [...s.positions, pos],
    }));
    return { ok: true, id: pos.id };
  },

  closeById: (pid, markPrice) => {
    const list = get().positions;
    const idx = list.findIndex((p) => p.id === pid);
    if (idx < 0) return { ok: false, error: 'Position not found.' };
    const pos = list[idx]!;
    const mark = Number.isFinite(markPrice) && markPrice > 0 ? markPrice : pos.entryPrice;
    const gross = pnlAtMark(pos, mark);
    const exitFee = pos.totalSize * CRYPTO_TAKER_FEE_RATE;
    const realized = gross - exitFee;
    const closed: CryptoPaperClosed = {
      ...pos,
      exitPrice: mark,
      realizedPnl: realized,
      closedAt: new Date().toISOString(),
    };
    set((s) => ({
      paperUsdt: s.paperUsdt + pos.margin + realized,
      positions: s.positions.filter((p) => p.id !== pid),
      closed: [...s.closed, closed],
    }));
    return { ok: true, pnl: realized };
  },

  reset: () => set({ paperUsdt: START, positions: [], closed: [] }),
}));
