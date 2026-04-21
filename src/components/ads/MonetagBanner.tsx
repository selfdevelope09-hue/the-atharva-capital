/**
 * MonetagBanner — renders a Monetag native-banner placeholder div.
 *
 * Monetag's tag.min.js (zone 232062, injected in _layout.tsx) scans the DOM
 * for `.monetag-banner` divs and fills them with native ads automatically.
 *
 * Placement rules (STRICT — do not move these):
 *   ✅ Below main navbar (strip)
 *   ✅ After every 3 rows in leaderboard
 *   ✅ Footer area of market pages
 *   ✅ Top of each leaderboard tab (video zone)
 *   ❌ NEVER inside chart container
 *   ❌ NEVER overlapping trade/order panels
 *   ❌ No popups, no push notifications
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
  const id = useRef(`mtg-${variant}-${++_mid}`).current;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const el = document.getElementById(id);
    if (!el) return;
    // Signal to Monetag script to fill this slot
    el.setAttribute('data-zone', '232062');
    el.setAttribute('data-type', variant === 'video' ? 'video' : 'native');
    // Trigger a re-scan if the script already ran
    if (typeof (window as unknown as Record<string, unknown>).__monetag === 'function') {
      try { (window as unknown as Record<string, unknown>).__monetag(); } catch { /* ok */ }
    }
  }, [id, variant]);

  if (Platform.OS !== 'web') return null;

  return (
    <View
      style={[
        {
          width: '100%',
          minHeight: variant === 'video' ? 100 : 60,
          backgroundColor: 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {/* @ts-ignore — web-only div */}
      <div
        id={id}
        className="monetag-banner"
        style={{ width: '100%', minHeight: variant === 'video' ? 100 : 60 }}
      />
    </View>
  );
}
