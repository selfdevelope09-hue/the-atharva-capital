/**
 * AADS Banner Ad Unit #2435144 — exact embed code as specified.
 * Web-only: renders null on native (no crash).
 * Auto-refreshes every 30 seconds by reloading the iframe src.
 *
 * Placement rules (STRICT):
 *  ✅ Below main navbar
 *  ✅ Sidebar bottom
 *  ✅ Below chart on mobile (above bottom nav)
 *  ❌ NEVER inside chart/candle area
 *  ❌ NEVER inside order/position panel
 *  ❌ NEVER over trade buttons
 */

import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';

const REFRESH_MS = 30_000;

export function AadsBanner() {
  const containerRef = useRef<View>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const refresh = () => {
      const iframe = document.querySelector<HTMLIFrameElement>('[data-aa="2435144"]');
      if (iframe) {
        const base = iframe.src.split('&t=')[0];
        iframe.src = '';
        // small tick to force reload
        setTimeout(() => { iframe.src = `${base}&t=${Date.now()}`; }, 50);
      }
    };

    timerRef.current = setInterval(refresh, REFRESH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (Platform.OS !== 'web') return null;

  return (
    <View
      style={{ width: '100%', alignItems: 'center', backgroundColor: 'transparent' }}
      // @ts-ignore — web-only dangerouslySetInnerHTML equivalent via nativeID
      nativeID="aads-banner-2435144"
    >
      {/* AADS Ad Unit 2435144 — exact embed code */}
      {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
      {/* @ts-ignore */}
      <div
        id="frame"
        style={{
          width: '100%',
          margin: 'auto',
          position: 'relative',
          zIndex: 99998,
        }}
        // @ts-ignore
        dangerouslySetInnerHTML={{
          __html: `<iframe data-aa='2435144'
            src='//acceptable.a-ads.com/2435144/?size=Adaptive'
            style='border:0;padding:0;width:70%;height:auto;overflow:hidden;display:block;margin:auto'
          ></iframe>`,
        }}
      />
    </View>
  );
}
