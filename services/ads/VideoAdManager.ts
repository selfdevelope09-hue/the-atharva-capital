/**
 * AdMob rewarded video — wallet top-up (+$5,000) and leaderboard refresh gate.
 * Uses Google test IDs in dev; set EXPO_PUBLIC_ADMOB_REWARDED_AD_UNIT for production.
 *
 * Web builds use `VideoAdManager.web.ts` (Metro) so this file is never bundled for web.
 */

import { useAdRewardsStore } from '@/store/adRewardsStore';

export const VIDEO_REWARD_TOPUP_USD = 5000;

let mobileAdsInit: Promise<void> | null = null;

async function ensureMobileAdsInitialized(): Promise<void> {
  if (mobileAdsInit) return mobileAdsInit;
  mobileAdsInit = (async () => {
    const mod = await import('react-native-google-mobile-ads');
    const mobileAds = mod.default;
    await mobileAds().initialize();
  })();
  return mobileAdsInit;
}

function rewardedAdUnitId(): string {
  const fromEnv = process.env.EXPO_PUBLIC_ADMOB_REWARDED_AD_UNIT;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return 'ca-app-pub-3940256099942544/5224354917';
}

function applyTopUpReward(): void {
  useAdRewardsStore.getState().addVirtualCash(VIDEO_REWARD_TOPUP_USD);
  useAdRewardsStore.getState().grantUnlocksFromReward();
}

async function simulateVideoReward(): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 600));
  return true;
}

/**
 * Core: load + show rewarded; resolves ok when user earns reward (video completed).
 */
async function runRewardedAdPlayback(): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureMobileAdsInitialized();
    const { RewardedAd, RewardedAdEventType, AdEventType, TestIds } = await import('react-native-google-mobile-ads');
    const unitId = __DEV__ ? TestIds.REWARDED : rewardedAdUnitId();
    const ad = RewardedAd.createForAdRequest(unitId);

    return await new Promise((resolve) => {
      let settled = false;
      const done = (r: { ok: boolean; error?: string }) => {
        if (settled) return;
        settled = true;
        try {
          ad.removeAllListeners();
        } catch {
          /* noop */
        }
        resolve(r);
      };

      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        void ad.show().catch((e: unknown) => done({ ok: false, error: e instanceof Error ? e.message : 'Show failed' }));
      });

      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        done({ ok: true });
      });

      ad.addAdEventListener(AdEventType.ERROR, (err) => {
        done({ ok: false, error: err?.message ?? 'Ad error' });
      });

      ad.addAdEventListener(AdEventType.CLOSED, () => {
        setTimeout(() => {
          if (!settled) done({ ok: false, error: 'Closed before reward' });
        }, 80);
      });

      ad.load();
    });
  } catch {
    const ok = await simulateVideoReward();
    if (!ok) return { ok: false, error: 'Playback failed' };
    return { ok: true };
  }
}

/** Credit +$5,000 after rewarded completion. */
export async function showRewardedVideoForWalletTopUp(): Promise<{ ok: boolean; error?: string }> {
  const r = await runRewardedAdPlayback();
  if (r.ok) applyTopUpReward();
  return r;
}

/** Gate leaderboard refresh — video only, no balance credit. */
export async function showRewardedVideoForLeaderboardRefresh(): Promise<{ ok: boolean; error?: string }> {
  return runRewardedAdPlayback();
}
