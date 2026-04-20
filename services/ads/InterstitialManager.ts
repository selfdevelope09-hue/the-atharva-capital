/**
 * Frequency-capped interstitials — max 3 per rolling hour.
 * Wire `tryShowInterstitial` to your mediation layer (AdMob / Meta / AppLovin).
 */

import { nextNetworkId } from '@/services/ads/adNetworks';

const HOUR_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 3;

const shownAt: number[] = [];

function prune(now: number) {
  while (shownAt.length && now - shownAt[0]! > HOUR_MS) {
    shownAt.shift();
  }
}

export function canShowInterstitial(): boolean {
  const now = Date.now();
  prune(now);
  return shownAt.length < MAX_PER_HOUR;
}

export function recordInterstitialShown(): void {
  shownAt.push(Date.now());
}

export type InterstitialTrigger = 'position_close' | 'launch' | 'manual';

/** Returns creative payload for round-robin network labeling (mediation). */
export function nextInterstitialPayload(trigger: InterstitialTrigger) {
  return {
    networkId: nextNetworkId(),
    trigger,
    placement: `interstitial_${trigger}`,
  };
}
