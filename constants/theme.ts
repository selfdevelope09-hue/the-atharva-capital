/**
 * Global design tokens: breakpoints + loaded font family keys (Expo `useFonts` map keys).
 * @see app/_layout.tsx for font registration.
 */

/** Exness / institutional terminal — pitch black canvas + neon gold CTAs. */
export const EXNESS = {
  bg: '#000000',
  border: '#1A1A1A',
  surface: '#000000',
  surface2: '#0A0A0A',
  text: '#EDEDED',
  textMuted: '#737373',
  accent: '#F5D742',
  chartBg: '#000000',
} as const;

/** Viewport width at which bottom tabs hide and the desktop left rail appears. */
export const NAV_BREAKPOINT = 900;

/** Fullscreen order UI uses a bottom sheet below this width (phones / small tablets). */
export const ORDER_SHEET_BREAKPOINT = 768;

/** Primary UI copy — Inter (loaded via @expo-google-fonts/inter). */
export const FontSans = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Prices, ticks, IDs — JetBrains Mono (tabular by design). */
export const FontMono = {
  regular: 'JetBrainsMono_400Regular',
  medium: 'JetBrainsMono_500Medium',
} as const;

/** Style object for numeric columns: mono + tabular lining (reduces jitter). */
export const tabularMonoStyle = {
  fontFamily: FontMono.regular,
  fontVariant: ['tabular-nums' as const],
};

export const tabularMonoMediumStyle = {
  fontFamily: FontMono.medium,
  fontVariant: ['tabular-nums' as const],
};

export const sansBodyStyle = {
  fontFamily: FontSans.regular,
};
