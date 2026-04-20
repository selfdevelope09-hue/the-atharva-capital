import type { AppMarket } from '@/constants/appMarkets';
import { amountToUsd } from '@/services/fx/frankfurter';
import type { LedgerClosedTrade, LedgerOpenPosition } from '@/types/ledger';
import { APP_MARKET_FIAT } from '@/src/utils/fxMarket';

export type CurveRange = '1D' | '1W' | '1M' | '3M' | 'ALL';

export function filterByRange<T extends { closedAt: string }>(rows: T[], range: CurveRange): T[] {
  const now = Date.now();
  const cut =
    range === '1D'
      ? now - 86400000
      : range === '1W'
        ? now - 86400000 * 7
        : range === '1M'
          ? now - 86400000 * 30
          : range === '3M'
            ? now - 86400000 * 90
            : 0;
  if (range === 'ALL') return rows;
  return rows.filter((r) => new Date(r.closedAt).getTime() >= cut);
}

export function tradePnlUsd(t: LedgerClosedTrade, rates: Record<string, number> | null): number {
  const fiat = APP_MARKET_FIAT[t.market];
  if (!rates) return t.realizedPnl;
  return amountToUsd(t.realizedPnl, fiat, rates);
}

export function unrealizedPnlLocal(p: LedgerOpenPosition, mark: number): number {
  return p.side === 'long' ? (mark - p.entryPrice) * p.qty : (p.entryPrice - mark) * p.qty;
}

export function unrealizedPnlUsd(p: LedgerOpenPosition, mark: number, rates: Record<string, number> | null): number {
  const u = unrealizedPnlLocal(p, mark);
  const fiat = APP_MARKET_FIAT[p.market];
  if (!rates) return u;
  return amountToUsd(u, fiat, rates);
}

export function winStreak(trades: LedgerClosedTrade[]): number {
  const sorted = [...trades].sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
  let n = 0;
  for (const t of sorted) {
    if (t.win) n++;
    else break;
  }
  return n;
}

export function dailyPnlMap(trades: LedgerClosedTrade[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of trades) {
    const day = t.closedAt.slice(0, 10);
    m.set(day, (m.get(day) ?? 0) + t.realizedPnl);
  }
  return m;
}

export function buildEquitySeries(
  trades: LedgerClosedTrade[],
  rates: Record<string, number> | null,
  range: CurveRange
): { ts: number; v: number }[] {
  const f = filterByRange(trades, range);
  const sorted = [...f].sort((a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime());
  let cum = 0;
  const pts: { ts: number; v: number }[] = [];
  for (const t of sorted) {
    cum += tradePnlUsd(t, rates);
    pts.push({ ts: new Date(t.closedAt).getTime(), v: cum });
  }
  return pts;
}

export function maxDrawdown(pts: { v: number }[]): number {
  if (pts.length === 0) return 0;
  let peak = pts[0].v;
  let maxDd = 0;
  for (const p of pts) {
    if (p.v > peak) peak = p.v;
    const dd = peak - p.v;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
}

export function fmtHold(ms: number): string {
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h <= 0) return `${mm}m`;
  return `${h}h ${mm}m`;
}
