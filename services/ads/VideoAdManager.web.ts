/**
 * Web stub — AdMob / react-native-google-mobile-ads is native-only and must not be imported on web.
 */

export const VIDEO_REWARD_TOPUP_USD = 5000;

const WEB_MSG = 'Rewarded video is not available in the browser. Use the iOS or Android app with AdMob.';

export async function showRewardedVideoForWalletTopUp(): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: WEB_MSG };
}

export async function showRewardedVideoForLeaderboardRefresh(): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: WEB_MSG };
}
