/**
 * BannerAd — web-only banner that injects an Adsterra script into a DOM node.
 * Returns null on iOS/Android (no ad on native = no crash).
 *
 * SETUP: Replace ADSTERRA_BANNER_SCRIPT_URL below with your Adsterra banner tag URL
 * from: Sites → theatharvacapital.com → Add Ad Format → Banner → Copy script src
 */

import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';

import { adRefreshManager } from '@/src/services/AdRefreshManager';

// ── Replace with your Adsterra banner script URLs ───────────────────────────
const ADSTERRA_DESKTOP_SCRIPT = ''; // e.g. '//www.topdisplayformat.com/...'
const ADSTERRA_MOBILE_SCRIPT  = ''; // 300x250 script for mobile web
// ────────────────────────────────────────────────────────────────────────────

export interface BannerAdProps {
  slot: 'top' | 'bottom' | 'inline';
  /** Refresh interval in ms. Default: 30 000 */
  refreshInterval?: number;
}

let _counter = 0;

export function BannerAd({ slot, refreshInterval = 30_000 }: BannerAdProps) {
  const idRef = useRef(`banner-ad-${++_counter}`);

  const loadAd = () => {
    if (typeof document === 'undefined') return;
    const container = document.getElementById(idRef.current);
    if (!container) return;

    // Clear previous ad content
    container.innerHTML = '';

    const scriptUrl = ADSTERRA_DESKTOP_SCRIPT || ADSTERRA_MOBILE_SCRIPT;
    if (!scriptUrl) return; // No URL yet — renders an empty slot

    try {
      const script = document.createElement('script');
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      script.src = scriptUrl;
      container.appendChild(script);
    } catch (e) {
      // Never crash the app due to ad failure
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    loadAd();
    adRefreshManager.startRefresh(idRef.current, loadAd, refreshInterval);

    return () => {
      adRefreshManager.stopRefresh(idRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshInterval]);

  if (Platform.OS !== 'web') return null;

  const minHeight = slot === 'top' ? 90 : 60;

  return (
    <View
      nativeID={idRef.current}
      style={{
        width: '100%',
        minHeight,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
      }}
    />
  );
}
