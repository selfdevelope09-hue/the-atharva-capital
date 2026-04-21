/**
 * RewardedAd — shows a button that, when tapped by the user, opens an Adsterra
 * direct link in a new tab and fires a reward callback after REWARD_DELAY_MS.
 *
 * Rules:
 *  • Only triggered by explicit user tap — NEVER auto-triggered.
 *  • Works on web and native (native opens the URL in the system browser).
 *
 * SETUP: Replace ADSTERRA_DIRECT_LINK with your direct-link URL from
 *        Adsterra → Sites → Direct Link.
 */

import React, { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from 'react-native';

// ── Replace with your Adsterra Direct Link ───────────────────────────────────
const ADSTERRA_DIRECT_LINK = ''; // e.g. 'https://www.adsterra.com/direct-link/...'
// ─────────────────────────────────────────────────────────────────────────────

/** Time to wait after opening the ad URL before rewarding the user (ms). */
const REWARD_DELAY_MS = 15_000;

export interface RewardedAdProps {
  /** Label shown inside the button. */
  label: string;
  /** Called once, REWARD_DELAY_MS after the user taps. */
  onReward: () => void;
  /** Optional secondary caption below the button. */
  caption?: string;
}

export function RewardedAd({ label, onReward, caption }: RewardedAdProps) {
  const [waiting, setWaiting] = useState(false);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePress = () => {
    if (waiting || done) return;

    const url = ADSTERRA_DIRECT_LINK;
    if (url) {
      if (Platform.OS === 'web') {
        try { window.open(url, '_blank', 'noopener,noreferrer'); } catch { /* ignore */ }
      } else {
        void Linking.openURL(url);
      }
    }

    setWaiting(true);
    timerRef.current = setTimeout(() => {
      setWaiting(false);
      setDone(true);
      try { onReward(); } catch { /* ignore */ }
    }, REWARD_DELAY_MS);
  };

  if (done) {
    return (
      <View style={{ alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: '#1a2e1a' }}>
        <Text style={{ color: '#00C805', fontWeight: '800', fontSize: 12 }}>Reward granted!</Text>
      </View>
    );
  }

  return (
    <View>
      <Pressable
        onPress={handlePress}
        disabled={waiting}
        style={{
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: '#f0b90b',
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 8,
          opacity: waiting ? 0.7 : 1,
        }}
      >
        {waiting && <ActivityIndicator size="small" color="#000" />}
        <Text style={{ color: '#000', fontWeight: '800', fontSize: 12 }}>
          {waiting ? 'Watching…' : label}
        </Text>
      </Pressable>
      {caption && !waiting ? (
        <Text style={{ color: '#7b8390', fontSize: 11, marginTop: 4 }}>{caption}</Text>
      ) : null}
    </View>
  );
}
