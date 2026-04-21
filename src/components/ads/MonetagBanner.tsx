/**
 * MonetagBanner — leaderboard-only native banner / video zone placeholder.
 *
 * Uses DOM injection via useEffect (NOT raw JSX HTML elements) to avoid
 * the "H is not a function" crash in React Native Web minified builds.
 *
 * RULES:
 *   ✅ Native banners: after every 3 rows in leaderboard
 *   ✅ Video zone: top of each leaderboard tab ONLY
 *   ❌ NEVER inside chart, order panels, or any other page
 *   ❌ NO autoplay, NO redirect, NO popunder, NO onclick hijack
 */

import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';

export type MonetagVariant = 'native' | 'video';

interface MonetagBannerProps {
  variant?: MonetagVariant;
  style?: object;
}

let _mid = 0;

export function MonetagBanner({ variant = 'native', style }: MonetagBannerProps) {
  const ref = useRef<View>(null);
  const divId = useRef(`mtg-${variant}-${++_mid}`).current;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const node = ref.current as unknown as HTMLElement | null;
    if (!node) return;

    const div = document.createElement('div');
    div.id = divId;
    div.className = 'monetag-banner';
    div.setAttribute('data-monetag-refresh', '1');
    div.setAttribute('data-monetag-variant', variant);
    div.style.cssText = `width:100%;min-height:${variant === 'video' ? 100 : 60}px`;

    // NOTE: We do NOT call any Monetag JS here — the script was removed because
    // zone 232062 was a popunder. These divs are kept as visual placeholders only.
    // Replace zone ID with a safe native-only zone if needed in future.

    node.appendChild(div);
    return () => { try { node.removeChild(div); } catch { /* ignore */ } };
  }, [divId, variant]);

  if (Platform.OS !== 'web') return null;

  return (
    <View
      ref={ref}
      style={[
        {
          width: '100%',
          minHeight: variant === 'video' ? 100 : 60,
          backgroundColor: 'transparent',
        },
        style,
      ]}
    />
  );
}
