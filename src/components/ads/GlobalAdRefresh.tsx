/**
 * Refreshes A-ADS iframes and Monetag placeholder containers every 30s (web only).
 * Safe: only touches ad nodes, never trading UI.
 */

import React, { useEffect } from 'react';
import { Platform } from 'react-native';

export function GlobalAdRefresh() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const tick = () => {
      try {
        document.querySelectorAll<HTMLIFrameElement>('iframe[data-aa="2435144"]').forEach((iframe) => {
          const base = iframe.src.split(/[&?]t=/)[0] || iframe.src;
          iframe.src = '';
          iframe.src = `${base}${base.includes('?') ? '&' : '?'}t=${Date.now()}`;
        });
      } catch {
        /* ignore */
      }

      try {
        document.querySelectorAll<HTMLElement>('[data-monetag-refresh="1"]').forEach((el) => {
          const clone = el.cloneNode(true);
          el.parentNode?.replaceChild(clone, el);
        });
      } catch {
        /* ignore */
      }
    };

    const w = typeof globalThis !== 'undefined' ? (globalThis as unknown as { window?: Window }).window : undefined;
    if (!w) return;
    const id = w.setInterval(tick, 30_000);
    return () => w.clearInterval(id);
  }, []);

  return null;
}
