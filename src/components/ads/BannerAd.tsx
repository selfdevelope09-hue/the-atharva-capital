/**
 * Adsterra banner ad — web only, refreshes every 30 seconds.
 *
 * HOW TO ACTIVATE:
 *  1. Go to Adsterra dashboard → Sites → theatharvacapital.com
 *  2. Add Ad Format → Banner (728×90 desktop / 300×250 mobile)
 *  3. Copy the generated <script> src URL
 *  4. Replace ADSTERRA_BANNER_SRC below with that URL
 *
 * Returns null silently on iOS / Android — no mobile ad SDK needed here.
 */

import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';

import { adRefreshManager } from '@/src/services/AdRefreshManager';

// ─── Configure these once you have your Adsterra account set up ───────────────
const ADSTERRA_BANNER_SRC = 'YOUR_ADSTERRA_BANNER_SCRIPT_URL';
// ─────────────────────────────────────────────────────────────────────────────

export interface BannerAdProps {
  slot: 'top' | 'bottom' | 'inline';
  /** Auto-refresh interval in milliseconds. Defaults to 30 000 (30 s). */
  refreshInterval?: number;
}

function loadIntoContainer(container: HTMLElement, slot: string): void {
  container.innerHTML = '';

  if (!ADSTERRA_BANNER_SRC || ADSTERRA_BANNER_SRC === 'YOUR_ADSTERRA_BANNER_SCRIPT_URL') {
    // Dev/unconfigured placeholder — shows a visible banner frame
    const ph = document.createElement('div');
    ph.style.cssText = `
      width:100%; height:${slot === 'top' ? '90px' : '60px'};
      background:linear-gradient(135deg,#1a1d23 0%,#161a1f 100%);
      border:1px solid #2a2e36; border-radius:6px;
      display:flex; align-items:center; justify-content:center;
      font-family:system-ui,sans-serif; font-size:11px;
      color:#4b5563; letter-spacing:1.5px; text-transform:uppercase;
    `;
    ph.textContent = 'Advertisement · Adsterra';
    container.appendChild(ph);
    return;
  }

  try {
    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = ADSTERRA_BANNER_SRC;
    container.appendChild(script);
  } catch {
    // Silently ignore ad load errors — never crash the app
  }
}

export function BannerAd({ slot, refreshInterval = 30_000 }: BannerAdProps) {
  // Stable unique ID per mount (different slot instances on the same screen get unique IDs)
  const idRef = useRef<string>('');
  if (!idRef.current) {
    idRef.current = `banner-${slot}-${Math.random().toString(36).slice(2, 8)}`;
  }

  useEffect(() => {
    // No-op on native — hook must be called unconditionally
    if (Platform.OS !== 'web') return;

    const containerId = idRef.current;

    function refresh(): void {
      const el = document.getElementById(containerId);
      if (el) loadIntoContainer(el, slot);
    }

    // Slight delay so the container is guaranteed to be in the DOM
    const initTimer = setTimeout(refresh, 120);
    adRefreshManager.startRefresh(containerId, refresh, refreshInterval);

    return () => {
      clearTimeout(initTimer);
      adRefreshManager.stopRefresh(containerId);
    };
  }, [slot, refreshInterval]);

  // Return nothing on native
  if (Platform.OS !== 'web') return null;

  const minHeight = slot === 'top' ? 90 : 60;

  return (
    <View
      style={{
        width: '100%',
        minHeight,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 4,
      }}
    >
      {/* React.createElement avoids TypeScript JSX errors for HTML elements in RN files */}
      {React.createElement('div', {
        id: idRef.current,
        style: { width: '100%', textAlign: 'center' },
      })}
    </View>
  );
}
