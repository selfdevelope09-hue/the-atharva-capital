/**
 * FX helpers — https://api.frankfurter.app (free, no key).
 * Base = USD: `rates.INR` ≈ INR per 1 USD → USD = amountInr / rates.INR
 */

export type FrankfurterLatest = {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
};

const BASE_URL = 'https://api.frankfurter.app/latest';

let cache: { fetchedAt: number; rates: Record<string, number> } | null = null;
const TTL_MS = 60 * 60 * 1000;

export async function fetchUsdBaseRates(signal?: AbortSignal): Promise<Record<string, number>> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < TTL_MS) return cache.rates;
  const res = await fetch(`${BASE_URL}?from=USD`, { signal });
  if (!res.ok) throw new Error(`Frankfurter: ${res.status}`);
  const j = (await res.json()) as FrankfurterLatest;
  cache = { fetchedAt: now, rates: j.rates };
  return j.rates;
}

/**
 * Convert an amount denominated in `currency` to USD.
 * Frankfurter `from=USD` rates are “quote per 1 USD” (e.g. INR≈83 → 1 USD = 83 INR).
 */
export function amountToUsd(amount: number, currency: string, usdBaseRates: Record<string, number>): number {
  if (!Number.isFinite(amount)) return 0;
  const c = currency.toUpperCase();
  if (c === 'USD' || c === 'USDT') return amount;
  const rate = usdBaseRates[c];
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return amount;
  return amount / rate;
}

/** Convert USD to a target currency amount (inverse of `amountToUsd`). */
export function usdToCurrency(usd: number, currency: string, usdBaseRates: Record<string, number>): number {
  const c = currency.toUpperCase();
  if (c === 'USD' || c === 'USDT') return usd;
  const rate = usdBaseRates[c];
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return usd;
  return usd * rate;
}
