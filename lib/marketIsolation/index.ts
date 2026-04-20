/**
 * Phase 1 — Pure helpers so search / watchlist / dashboard never mix markets.
 */

import type { AppMarket } from '@/constants/appMarkets';

export type WithMarket = { market: AppMarket };

export function filterByMarket<T extends WithMarket>(items: readonly T[], current: AppMarket): T[] {
  return items.filter((s) => s.market === current);
}

export function filterRowsByQuery<T extends { name: string } & WithMarket>(
  all: readonly T[],
  currentMarket: AppMarket,
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  const scoped = filterByMarket(all, currentMarket);
  if (!q) return [...scoped];
  return scoped.filter((s) => s.name.toLowerCase().includes(q));
}

export type GroupedByMarket<T extends WithMarket> = Partial<Record<AppMarket, T[]>>;

export function groupByMarket<T extends WithMarket>(items: readonly T[]): GroupedByMarket<T> {
  const out: GroupedByMarket<T> = {};
  for (const item of items) {
    const m = item.market;
    if (!out[m]) out[m] = [];
    out[m]!.push(item);
  }
  return out;
}

export function sameMarket(a: AppMarket, b: AppMarket): boolean {
  return a === b;
}

/** Canonical cache key for price rows: `${market}:${symbolFull}`. */
export function priceCacheKey(market: AppMarket, symbolFull: string): string {
  return `${market}:${symbolFull.toUpperCase()}`;
}
