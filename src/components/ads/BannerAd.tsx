/**
 * BannerAd — embeds the AADS unit #2435144 (adaptive iframe).
 *
 * AADS ad unit code (DO NOT MODIFY):
 * <div id="frame" style="width:100%;margin:auto;position:relative;z-index:99998;">
 *   <iframe data-aa='2435144'
 *     src='//acceptable.a-ads.com/2435144/?size=Adaptive'
 *     style='border:0;padding:0;width:70%;height:auto;overflow:hidden;display:block;margin:auto'>
 *   </iframe>
 * </div>
 *
 * Auto-refreshes every 30 seconds by cycling the iframe src.
 * Returns null on native (iOS/Android) — no crash.
 */

import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';

import { adRefreshManager } from '@/src/services/AdRefreshManager';

export interface BannerAdProps {
  slot?: 'top' | 'bottom' | 'inline';
  /** Refresh interval in ms. Default: 30 000 */
  refreshInterval?: number;
}

let _counter = 0;

export function BannerAd({ slot = 'bottom', refreshInterval = 30_000 }: BannerAdProps) {
  const containerId = useRef(`aads-frame-${++_counter}`).current;

  const injectAd = () => {
    if (typeof document === 'undefined') return;
    const container = document.getElementById(containerId);
    if (!container) return;

    // Build the AADS iframe safely using DOM APIs (no innerHTML string)
    container.innerHTML = '';
    const frame = document.createElement('div');
    frame.style.cssText = 'width:100%;margin:auto;position:relative;z-index:1';
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-aa', '2435144');
    iframe.src = `//acceptable.a-ads.com/2435144/?size=Adaptive&t=${Date.now()}`;
    iframe.style.cssText = 'border:0;padding:0;width:70%;height:auto;overflow:hidden;display:block;margin:auto;pointer-events:auto';
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
    frame.appendChild(iframe);
    container.appendChild(frame);
  };

  const refreshAd = () => {
    if (typeof document === 'undefined') return;
    const iframe = document.querySelector<HTMLIFrameElement>('[data-aa="2435144"]');
    if (iframe) {
      const base = '//acceptable.a-ads.com/2435144/?size=Adaptive';
      iframe.src = '';
      requestAnimationFrame(() => { iframe.src = `${base}&t=${Date.now()}`; });
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    injectAd();
    adRefreshManager.startRefresh(containerId, refreshAd, refreshInterval);
    return () => adRefreshManager.stopRefresh(containerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshInterval]);

  if (Platform.OS !== 'web') return null;

  const minHeight = slot === 'top' ? 90 : slot === 'inline' ? 60 : 80;

  return (
    <View
      nativeID={containerId}
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
