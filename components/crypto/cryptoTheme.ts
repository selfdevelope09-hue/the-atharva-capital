/**
 * Shared Binance-inspired palette and formatters for the Crypto section.
 * All components stick to pure inline styles; values live here for consistency.
 */

export const CRYPTO_THEME = {
  bg: '#0b0e11',
  surface: '#1e2329',
  surfaceAlt: '#181a20',
  border: '#2b3139',
  borderStrong: '#474d57',
  text: '#eaecef',
  textMuted: '#848e9c',
  textDim: '#5e6673',
  accent: '#f0b90b',
  accentSoft: 'rgba(240, 185, 11, 0.15)',
  up: '#0ecb81',
  upSoft: 'rgba(14, 203, 129, 0.12)',
  down: '#f6465d',
  downSoft: 'rgba(246, 70, 93, 0.12)',
  live: '#0ecb81',
} as const;

export type CryptoTheme = typeof CRYPTO_THEME;

export function displayBase(symbol: string): string {
  return symbol.replace(/USDT$/u, '').replace(/BUSD$/u, '');
}

export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '-';
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (abs >= 1) return value.toFixed(2);
  if (abs >= 0.01) return value.toFixed(4);
  return value.toFixed(6);
}

export function formatPct(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatCompactUsd(value: number): string {
  if (!Number.isFinite(value)) return '-';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}
