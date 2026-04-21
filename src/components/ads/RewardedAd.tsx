/**
 * Intentional rewarded-ad button.
 *
 * The ad is shown ONLY when the user consciously taps "Watch Ad".
 * It opens the Adsterra direct link in a new tab (web) or an
 * in-app browser (native — future), then grants the reward after
 * `rewardDelayMs` ms to simulate a watched ad session.
 *
 * HOW TO ACTIVATE:
 *  1. Adsterra dashboard → Direct Links → copy your link URL
 *  2. Replace ADSTERRA_DIRECT_LINK below with that URL
 */

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { T } from '@/src/constants/theme';

// ─── Configure once you have your Adsterra account set up ─────────────────────
const ADSTERRA_DIRECT_LINK = 'YOUR_ADSTERRA_DIRECT_LINK';
// ─────────────────────────────────────────────────────────────────────────────

export interface RewardedAdButtonProps {
  /** CTA text shown on the button before the user taps */
  label: string;
  /** Short line describing what the user gets */
  rewardDescription: string;
  /** Called once the simulated ad watch delay elapses */
  onReward: () => void;
  /** Milliseconds to wait before crediting reward (simulates watch time). Default 15 000. */
  rewardDelayMs?: number;
  style?: object;
}

export function RewardedAdButton({
  label,
  rewardDescription,
  onReward,
  rewardDelayMs = 15_000,
  style,
}: RewardedAdButtonProps) {
  const [waiting, setWaiting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const rewardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Decrement countdown every second while waiting
  useEffect(() => {
    if (!waiting || secondsLeft <= 0) return;
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1_000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [waiting, secondsLeft]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rewardTimerRef.current) clearTimeout(rewardTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  function handlePress(): void {
    if (waiting) return;

    // Open Adsterra direct link in a new tab (user intentionally clicked)
    if (typeof window !== 'undefined' && ADSTERRA_DIRECT_LINK !== 'YOUR_ADSTERRA_DIRECT_LINK') {
      try {
        window.open(ADSTERRA_DIRECT_LINK, '_blank', 'noopener,noreferrer');
      } catch {
        // Ignore popup blockers
      }
    }

    const delaySec = Math.ceil(rewardDelayMs / 1_000);
    setWaiting(true);
    setSecondsLeft(delaySec);

    rewardTimerRef.current = setTimeout(() => {
      setWaiting(false);
      setSecondsLeft(0);
      try {
        onReward();
      } catch {
        // Reward callback errors must not crash the UI
      }
    }, rewardDelayMs);
  }

  return (
    <View style={[{ gap: 8 }, style]}>
      <Text style={{ color: T.text3, fontSize: 12 }}>{rewardDescription}</Text>
      <Pressable
        onPress={handlePress}
        disabled={waiting}
        style={{
          backgroundColor: waiting ? T.bg2 : T.yellow,
          paddingVertical: 14,
          paddingHorizontal: 20,
          borderRadius: 8,
          alignItems: 'center',
          borderWidth: waiting ? 1 : 0,
          borderColor: T.yellow,
          opacity: waiting ? 0.85 : 1,
        }}
      >
        <Text style={{ color: waiting ? T.yellow : '#000', fontWeight: '800', fontSize: 13 }}>
          {waiting ? `Crediting in ${secondsLeft}s…` : label}
        </Text>
      </Pressable>
    </View>
  );
}
