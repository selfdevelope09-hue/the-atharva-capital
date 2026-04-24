/**
 * A-ADS adaptive banner — unit #2435144.
 * Web-only DOM injection (exact structure per publisher). Does not touch chart/order code.
 */

import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';

const IFRAME_SRC = 'https://acceptable.a-ads.com/2435144/?size=Adaptive';

export function AadsAdaptiveBanner({ widthPct = 70 }: { widthPct?: number }) {
  const hostRef = useRef<View>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host) return;

    const frame = document.createElement('div');
    frame.id = 'frame';
    frame.style.cssText = `width:${widthPct}%;max-width:100%;margin:auto;position:relative;z-index:99998;`;

    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-aa', '2435144');
    iframe.src = IFRAME_SRC;
    iframe.style.cssText =
      'border:0;padding:0;width:100%;height:auto;overflow:hidden;display:block;pointer-events:auto;';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
    iframe.setAttribute('title', 'Advertisement');
    iframe.setAttribute('loading', 'lazy');

    frame.appendChild(iframe);
    host.appendChild(frame);

    return () => {
      try {
        host.removeChild(frame);
      } catch {
        /* ignore */
      }
    };
  }, [widthPct]);

  if (Platform.OS !== 'web') return null;

  return (
    <View
      ref={hostRef}
      style={{ width: '100%', minHeight: 64, alignItems: 'center', justifyContent: 'center' }}
    />
  );
}
