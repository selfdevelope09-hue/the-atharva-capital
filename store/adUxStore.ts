/**
 * Phase 27 — Hide monetization chrome during critical trading UX.
 */

import { create } from 'zustand';

export type AdUxState = {
  isOrderFormOpen: boolean;
  isChartInteracting: boolean;
  setOrderFormOpen: (v: boolean) => void;
  setChartInteracting: (v: boolean) => void;
  /** Debounced chart interaction — call from chart pan/zoom */
  pulseChartInteraction: () => void;
};

let chartTimer: ReturnType<typeof setTimeout> | null = null;

export const useAdUxStore = create<AdUxState>((set, get) => ({
  isOrderFormOpen: false,
  isChartInteracting: false,
  setOrderFormOpen: (v) => set({ isOrderFormOpen: v }),
  setChartInteracting: (v) => set({ isChartInteracting: v }),
  pulseChartInteraction: () => {
    set({ isChartInteracting: true });
    if (chartTimer) clearTimeout(chartTimer);
    chartTimer = setTimeout(() => {
      set({ isChartInteracting: false });
      chartTimer = null;
    }, 1800);
  },
}));

export function shouldShowBannerChrome(): boolean {
  const { isOrderFormOpen, isChartInteracting } = useAdUxStore.getState();
  return !isOrderFormOpen && !isChartInteracting;
}
