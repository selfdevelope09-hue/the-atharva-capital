export const T = {
  bg0: '#0a0a0a',
  bg1: '#13161b',
  bg2: '#1a1d23',
  bg3: '#22262d',

  border: '#2a2e36',
  borderBright: '#3a3f48',

  text0: '#ffffff',
  text1: '#d1d5db',
  text2: '#9ca3af',
  text3: '#6b7280',

  green: '#0ecb81',
  greenDim: 'rgba(14,203,129,0.12)',
  red: '#f6465d',
  redDim: 'rgba(246,70,93,0.12)',
  yellow: '#f0b90b',
  blue: '#3b82f6',
  violet: '#8b5cf6',

  radiusSm: 6,
  radiusMd: 10,
  radiusLg: 14,
  radiusXl: 20,

  fontMono: 'JetBrainsMono_500Medium',
  fontSans: 'Inter_500Medium',
  fontSansBold: 'Inter_700Bold',

  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;

export type ThemeShape = typeof T;

export const FEE_DEFAULTS = {
  maker: 0.0002,
  taker: 0.0005,
} as const;

export function fmtMoney(v: number | null | undefined, symbol = '$', digits = 2): string {
  if (v == null || !isFinite(v)) return `${symbol}—`;
  const abs = Math.abs(v);
  const d = abs >= 1000 ? 2 : abs >= 1 ? digits : 6;
  return `${symbol}${v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

export function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v == null || !isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
}

export function fmtCompact(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  return v.toFixed(2);
}
