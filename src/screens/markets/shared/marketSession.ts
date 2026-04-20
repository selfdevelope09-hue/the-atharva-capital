import type { MarketConfig, MarketId } from '../../../constants/markets';

export type VenueSessionLabel = 'OPEN' | 'CLOSED' | 'PRE-OPEN';

/** Map Yahoo `marketState` string to coarse UI badge. */
export function sessionFromYahooMarketState(state?: string | null): VenueSessionLabel {
  const u = (state ?? '').toUpperCase();
  if (!u) return 'CLOSED';
  if (u === 'REGULAR' || u === 'OPEN' || u === 'TRADING') return 'OPEN';
  if (u.includes('PRE') || u === 'EARLY_TRADING') return 'PRE-OPEN';
  if (u.includes('POST')) return 'CLOSED';
  if (u === 'CLOSED' || u === 'HOLIDAY') return 'CLOSED';
  return 'CLOSED';
}

export function sessionForMarket(
  marketId: MarketId,
  tickMarketState: string | null | undefined
): VenueSessionLabel {
  if (marketId === 'crypto') return 'OPEN';
  return sessionFromYahooMarketState(tickMarketState);
}

export function formatMarketClock(now: Date, timeZone: string | undefined): string {
  const tz = timeZone ?? 'Etc/UTC';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now);
  } catch {
    return now.toISOString().slice(11, 19) + ' UTC';
  }
}

export function sessionBadgeColor(label: VenueSessionLabel, accent: string): string {
  if (label === 'OPEN') return '#0ecb81';
  if (label === 'PRE-OPEN') return '#f0b90b';
  return '#f6465d';
}

export function describeMarketHours(cfg: MarketConfig): string {
  return cfg.hours ?? '—';
}
