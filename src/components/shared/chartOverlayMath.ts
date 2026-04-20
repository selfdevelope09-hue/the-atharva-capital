/**
 * Shared TP/SL overlay math — matches `components/crypto/TpSlOverlay.tsx` exactly.
 * `top` / `bottom` are price axis values (top = higher price).
 */

export type PriceBand = { high: number; low: number };

/** Visible band with vertical padding, same as crypto `paddedBand`. */
export function paddedBand(
  band: PriceBand,
  entry: number,
  tp: number,
  sl: number
): { top: number; bottom: number } {
  const all = [band.high, band.low, entry, tp, sl].filter((n) => Number.isFinite(n) && n > 0);
  if (all.length === 0) return { top: entry * 1.1, bottom: entry * 0.9 };
  const hi = Math.max(...all);
  const lo = Math.min(...all);
  const span = Math.max(hi - lo, hi * 0.01);
  return { top: hi + span * 0.15, bottom: Math.max(0, lo - span * 0.15) };
}

/** Fallback when no live 24h band: derive from entry / TP / SL only. */
export function deriveFallbackBand(entry: number, tp: number, sl: number): PriceBand {
  const pts = [entry, tp, sl].filter((n) => Number.isFinite(n) && n > 0);
  const base = entry || 1;
  const pad = Math.max(Math.abs(base) * 0.05, 0.01);
  if (pts.length === 0) return { high: base + pad, low: Math.max(0, base - pad) };
  return {
    high: Math.max(...pts) + pad,
    low: Math.max(0, Math.min(...pts) - pad),
  };
}

/** Combined range for mapping (crypto `priceToY` / `yToPrice`). */
export function getRange(
  priceBand: PriceBand | undefined,
  entry: number,
  takeProfit: number,
  stopLoss: number
): { top: number; bottom: number } {
  if (priceBand && priceBand.high > priceBand.low) {
    return paddedBand(priceBand, entry, takeProfit, stopLoss);
  }
  const fb = deriveFallbackBand(entry, takeProfit, stopLoss);
  return paddedBand(fb, entry, takeProfit, stopLoss);
}

export function priceToY(price: number, top: number, bottom: number, heightPx: number): number {
  if (bottom === top || heightPx <= 0) return heightPx / 2;
  const ratio = (top - price) / (top - bottom);
  return Math.max(0, Math.min(heightPx, ratio * heightPx));
}

function priceNum(v: number): number {
  return Number.isFinite(v) ? v : 0;
}

/** Map pixel Y → price (same as crypto `yToPrice`). */
export function yToPrice(
  yPx: number,
  top: number,
  bottom: number,
  heightPx: number,
  entryFallback: number
): number {
  if (heightPx <= 0) return priceNum(entryFallback);
  const clamped = Math.max(0, Math.min(heightPx, yPx));
  const ratio = clamped / heightPx;
  return priceNum(top - ratio * (top - bottom));
}

export function pctPnl(entry: number, target: number, side: 'long' | 'short'): number {
  if (!Number.isFinite(entry) || entry <= 0) return 0;
  const raw = ((target - entry) / entry) * 100;
  return side === 'short' ? -raw : raw;
}

export function computeRR(
  entry: number,
  tp: number,
  sl: number,
  side: 'long' | 'short'
): number {
  const reward = Math.abs(tp - entry);
  const risk = Math.abs(entry - sl);
  if (risk <= 0) return 0;
  if (side === 'long' && (tp <= entry || sl >= entry)) return 0;
  if (side === 'short' && (tp >= entry || sl <= entry)) return 0;
  return reward / risk;
}
