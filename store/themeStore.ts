import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { create } from 'zustand';

import { EXNESS } from '@/constants/theme';

const STORAGE_KEY = '@tac_theme_preference';

export type ThemePreference = 'light' | 'dark' | 'system';

export type ThemePalette = {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  chartBg: string;
};

const lightPalette: ThemePalette = {
  bg: '#f4f4f5',
  surface: '#ffffff',
  surface2: '#e4e4e7',
  text: '#18181b',
  textMuted: '#52525b',
  border: '#d4d4d8',
  accent: '#16a34a',
  chartBg: '#fafafa',
};

const darkPalette: ThemePalette = {
  bg: EXNESS.bg,
  surface: EXNESS.surface,
  surface2: EXNESS.surface2,
  text: EXNESS.text,
  textMuted: EXNESS.textMuted,
  border: EXNESS.border,
  accent: EXNESS.accent,
  chartBg: EXNESS.chartBg,
};

function resolveScheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    const sys = Appearance.getColorScheme();
    return sys === 'light' ? 'light' : 'dark';
  }
  return pref;
}

type ThemeState = {
  preference: ThemePreference;
  resolvedScheme: 'light' | 'dark';
  palette: ThemePalette;
  /** Call once from root (e.g. `_layout`) to hydrate + subscribe to OS theme. */
  init: () => Promise<void>;
  setPreference: (pref: ThemePreference) => Promise<void>;
};

let appearanceSub: ReturnType<typeof Appearance.addChangeListener> | null = null;

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: 'system',
  resolvedScheme: 'dark',
  palette: darkPalette,

  init: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const pref = (raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system') as ThemePreference;
      const resolved = resolveScheme(pref);
      set({
        preference: pref,
        resolvedScheme: resolved,
        palette: resolved === 'light' ? lightPalette : darkPalette,
      });
    } catch {
      set({ preference: 'system', resolvedScheme: resolveScheme('system'), palette: darkPalette });
    }

    const apply = () => {
      const { preference } = get();
      const resolved = resolveScheme(preference);
      set({
        resolvedScheme: resolved,
        palette: resolved === 'light' ? lightPalette : darkPalette,
      });
    };

    if (!appearanceSub) {
      appearanceSub = Appearance.addChangeListener(() => {
        if (get().preference === 'system') apply();
      });
    }
  },

  setPreference: async (pref) => {
    await AsyncStorage.setItem(STORAGE_KEY, pref);
    const resolved = resolveScheme(pref);
    set({
      preference: pref,
      resolvedScheme: resolved,
      palette: resolved === 'light' ? lightPalette : darkPalette,
    });
  },
}));
