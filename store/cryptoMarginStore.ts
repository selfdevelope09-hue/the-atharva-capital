import { create } from 'zustand';

/** Binance-style fee tiers (USDT-M linear, illustrative). */
export const CRYPTO_MAKER_FEE_RATE = 0.0002; // 0.02%
export const CRYPTO_TAKER_FEE_RATE = 0.0005; // 0.05%

const DEFAULT_MAINTENANCE_MARGIN_RATE = 0.004;

export type CryptoMarginMode = 'cross' | 'isolated';
export type CryptoPositionSide = 'long' | 'short';
export type CryptoFeeScenario = 'maker' | 'taker';

export type CryptoMarginState = {
  /** Active futures symbol (venue-style). */
  symbol: string;
  /** Base-asset position size (e.g. BTC quantity). */
  positionQty: number;
  /** Mark / entry price in quote (USDT). */
  entryPrice: number;
  side: CryptoPositionSide;
  /** 1x–125x (crypto paper terminal) */
  leverage: number;
  marginMode: CryptoMarginMode;
  takeProfitPrice: number;
  stopLossPrice: number;
  /** Which fee rate to show in previews. */
  feeScenario: CryptoFeeScenario;

  setSymbol: (symbol: string) => void;
  setPositionQty: (qty: number) => void;
  setEntryPrice: (price: number) => void;
  setSide: (side: CryptoPositionSide) => void;
  setLeverage: (lev: number) => void;
  setMarginMode: (mode: CryptoMarginMode) => void;
  setTakeProfitPrice: (p: number) => void;
  setStopLossPrice: (p: number) => void;
  setFeeScenario: (s: CryptoFeeScenario) => void;
  /** One-shot seed from live mark; nudges TP/SL if still at defaults. */
  seedFromMarkPrice: (mark: number) => void;

  getNotionalUsd: () => number;
  /** (Position Size * Entry Price) / Leverage */
  getRequiredMarginUsd: () => number;
  getLiquidationPrice: () => number;
  getTradingFeeUsd: () => number;
};

function clampLev(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 1;
  return Math.min(125, Math.max(1, Math.round(n)));
}

function clampQty(q: number): number {
  if (Number.isNaN(q) || !Number.isFinite(q)) return 0;
  return Math.max(0, q);
}

function clampPrice(p: number): number {
  if (Number.isNaN(p) || !Number.isFinite(p)) return 0;
  return Math.max(1e-8, p);
}

/**
 * Isolated linear perp approximation (USDT-margined).
 * Long: liq when price falls to entry * (1 - IMR - MMR) with IMR ≈ 1/L.
 * Short: liq when price rises to entry * (1 + IMR + MMR).
 */
export function computeLiquidationPrice(
  entry: number,
  leverage: number,
  side: CryptoPositionSide,
  maintenanceMarginRate: number = DEFAULT_MAINTENANCE_MARGIN_RATE
): number {
  const L = Math.max(1, leverage);
  const e = clampPrice(entry);
  const imr = 1 / L;
  if (side === 'long') {
    return e * Math.max(0, 1 - imr - maintenanceMarginRate);
  }
  return e * (1 + imr + maintenanceMarginRate);
}

export function computeRequiredMarginUsd(positionQty: number, entryPrice: number, leverage: number): number {
  const notional = clampQty(positionQty) * clampPrice(entryPrice);
  return notional / Math.max(1, leverage);
}

export function computeTradingFeeUsd(notionalUsd: number, scenario: CryptoFeeScenario): number {
  const r = scenario === 'maker' ? CRYPTO_MAKER_FEE_RATE : CRYPTO_TAKER_FEE_RATE;
  return notionalUsd * r;
}

const SEED_TP_FRAC = 0.012;
const SEED_SL_FRAC = 0.008;

export const useCryptoMarginStore = create<CryptoMarginState>((set, get) => ({
  symbol: 'BTCUSDT',
  positionQty: 0.02,
  entryPrice: 97_200,
  side: 'long',
  leverage: 20,
  marginMode: 'isolated',
  takeProfitPrice: 97_200 * (1 + SEED_TP_FRAC),
  stopLossPrice: 97_200 * (1 - SEED_SL_FRAC),
  feeScenario: 'taker',

  setSymbol: (symbol) => set({ symbol }),
  setPositionQty: (positionQty) => set({ positionQty: clampQty(positionQty) }),
  setEntryPrice: (entryPrice) => set({ entryPrice: clampPrice(entryPrice) }),
  setSide: (side) => set({ side }),
  setLeverage: (leverage) => set({ leverage: clampLev(leverage) }),
  setMarginMode: (marginMode) => set({ marginMode }),
  setTakeProfitPrice: (takeProfitPrice) => set({ takeProfitPrice: clampPrice(takeProfitPrice) }),
  setStopLossPrice: (stopLossPrice) => set({ stopLossPrice: clampPrice(stopLossPrice) }),
  setFeeScenario: (feeScenario) => set({ feeScenario }),

  seedFromMarkPrice: (mark) => {
    const m = clampPrice(mark);
    set({
      entryPrice: m,
      takeProfitPrice: m * (1 + SEED_TP_FRAC),
      stopLossPrice: m * (1 - SEED_SL_FRAC),
    });
  },

  getNotionalUsd: () => {
    const s = get();
    return clampQty(s.positionQty) * clampPrice(s.entryPrice);
  },
  getRequiredMarginUsd: () => {
    const s = get();
    return computeRequiredMarginUsd(s.positionQty, s.entryPrice, s.leverage);
  },
  getLiquidationPrice: () => {
    const s = get();
    return computeLiquidationPrice(s.entryPrice, s.leverage, s.side);
  },
  getTradingFeeUsd: () => {
    const s = get();
    return computeTradingFeeUsd(s.getNotionalUsd(), s.feeScenario);
  },
}));
