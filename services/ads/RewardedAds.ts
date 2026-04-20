/**
 * Rewarded ad engine — "Watch to earn" virtual cash + 24h unlocks for premium surfaces.
 * SDKs: replace `simulateRewardedPlayback` with AdMob / Meta / AppLovin rewarded APIs.
 */

import { useAdRewardsStore } from '@/store/adRewardsStore';

const REWARD_USD = 500;

/** Mock playback — resolves true when user would earn reward (integrate real SDK here). */
export function simulateRewardedPlayback(): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), 800);
  });
}

/**
 * Show rewarded flow: on completion credits +$500 (USA sleeve) and unlocks premium for 24h.
 */
export async function runRewardedForCashAndUnlocks(): Promise<{ ok: boolean; error?: string }> {
  try {
    const completed = await simulateRewardedPlayback();
    if (!completed) return { ok: false, error: 'Not completed' };
    useAdRewardsStore.getState().addVirtualCash(REWARD_USD);
    useAdRewardsStore.getState().grantUnlocksFromReward();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Reward failed' };
  }
}

export const REWARDED_REWARD_USD = REWARD_USD;
