import { create } from 'zustand';

import {
  canShowInterstitial,
  nextInterstitialPayload,
  recordInterstitialShown,
  type InterstitialTrigger,
} from '@/services/ads/InterstitialManager';

export type InterstitialUiState = {
  visible: boolean;
  headline: string;
  body: string;
  networkLabel: string;
  show: (trigger: InterstitialTrigger) => void;
  hide: () => void;
};

const COPY: Record<InterstitialTrigger, { headline: string; body: string }> = {
  position_close: {
    headline: 'Lock in your edge',
    body: 'Institutional-grade research tools — limited-time partner offer.',
  },
  launch: {
    headline: 'Welcome back, trader',
    body: 'Upgrade execution with lower-latency routes on select venues.',
  },
  manual: {
    headline: 'Sponsored',
    body: 'Explore partner offers curated for active portfolios.',
  },
};

export const useInterstitialUiStore = create<InterstitialUiState>((set) => ({
  visible: false,
  headline: '',
  body: '',
  networkLabel: '',
  show: (trigger) => {
    if (!canShowInterstitial()) return;
    recordInterstitialShown();
    const p = nextInterstitialPayload(trigger);
    const c = COPY[trigger];
    set({
      visible: true,
      headline: c.headline,
      body: c.body,
      networkLabel: p.networkId,
    });
  },
  hide: () => set({ visible: false }),
}));
