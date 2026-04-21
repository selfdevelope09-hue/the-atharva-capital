/**
 * AADS Banner Ad Unit #2435144 — safe DOM injection (no dangerouslySetInnerHTML).
 * Web-only: renders null on native.
 * Auto-refreshes every 30 seconds.
 *
 * Placement rules:
 *  ✅ Below main navbar / sidebar bottom / below chart on mobile
 *  ❌ NEVER inside chart / order / position panels
 */

import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';

const REFRESH_MS = 30_000;
const AD_UNIT = '2435144';

export function AadsBanner() {
  const containerRef = useRef<View>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    // Find the DOM node backing the View ref
    const domNode = (containerRef.current as unknown as HTMLElement | null);
    if (!domNode) return;

    // Build the AADS iframe via DOM API (no dangerouslySetInnerHTML)
    const frame = document.createElement('div');
    frame.id = 'aads-frame-2435144';
    frame.style.cssText = `width:100%;margin:auto;position:relative;z-index:99998`;

    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-aa', AD_UNIT);
    iframe.src = `//acceptable.a-ads.com/${AD_UNIT}/?size=Adaptive`;
    iframe.style.cssText = `border:0;padding:0;width:70%;height:auto;overflow:hidden;display:block;margin:auto`;
    iframe.setAttribute('scrolling', 'no');

    frame.appendChild(iframe);
    domNode.appendChild(frame);

    // 30-second refresh
    const intervalId = setInterval(() => {
      const el = domNode.querySelector<HTMLIFrameElement>(`[data-aa="${AD_UNIT}"]`);
      if (el) {
        const base = el.src.split('&t=')[0];
        el.src = '';
        setTimeout(() => { el.src = `${base}&t=${Date.now()}`; }, 50);
      }
    }, REFRESH_MS);

    return () => {
      clearInterval(intervalId);
      try { domNode.removeChild(frame); } catch { /* already removed */ }
    };
  }, []);

  if (Platform.OS !== 'web') return null;

  return (
    <View
      ref={containerRef}
      style={{ width: '100%', minHeight: 60, alignItems: 'center', justifyContent: 'center' }}
    />
  );
}
