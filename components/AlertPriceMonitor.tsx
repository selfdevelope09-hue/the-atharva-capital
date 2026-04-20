import React, { useEffect, useRef } from 'react';

import { auth } from '@/config/firebaseConfig';
import { useUnifiedMarketsPrices } from '@/contexts/UnifiedMarketsPriceContext';
import { subscribeAlerts, updateAlert, type AlertDoc } from '@/services/firebase/alertsRepository';
import { useAlertUiStore } from '@/store/alertUiStore';
import { useNotificationStore } from '@/store/notificationStore';

/**
 * Polls live ticks every 15s against Firestore alerts; shows in-app toasts via `notificationStore`.
 */
export function AlertPriceMonitor() {
  const { ticks, subscribeMarket } = useUnifiedMarketsPrices();
  const alertsRef = useRef<AlertDoc[]>([]);
  const lastFireRef = useRef<Record<string, number>>({});
  const push = useNotificationStore((s) => s.push);
  const setActiveCount = useAlertUiStore((s) => s.setActiveCount);

  useEffect(() => {
    const u = auth?.currentUser;
    if (!u) {
      setActiveCount(0);
      return;
    }
    const unsub = subscribeAlerts(u.uid, (rows) => {
      alertsRef.current = rows;
      setActiveCount(rows.filter((r) => r.active).length);
      const mk = new Set(rows.map((r) => r.market));
      mk.forEach((m) => subscribeMarket(m));
    });
    return () => unsub();
  }, [subscribeMarket, setActiveCount]);

  useEffect(() => {
    const id = setInterval(() => {
      const user = auth?.currentUser;
      if (!user) return;
      const list = alertsRef.current.filter((a) => a.active);
      const now = Date.now();
      for (const a of list) {
        const tick = ticks[a.symbolFull];
        const px = tick?.price;
        if (px == null || !isFinite(px)) continue;
        const hit = a.condition === 'above' ? px >= a.price : px <= a.price;
        if (!hit) continue;

        if (a.alertType === 'daily') {
          const last = a.triggeredAt ? new Date(a.triggeredAt).getTime() : 0;
          if (now - last < 20 * 3600 * 1000) continue;
        }
        if (a.alertType === 'every') {
          const last = lastFireRef.current[a.id] ?? 0;
          if (now - last < 60000) continue;
        }

        lastFireRef.current[a.id] = now;

        push(`🔔 ${a.symbol} ${a.condition} ${a.price.toFixed(4)} — now ${px.toFixed(4)}`);

        const nextCount = (a.triggerCount ?? 0) + 1;
        if (a.alertType === 'once') {
          void updateAlert(user.uid, a.id, {
            active: false,
            triggeredAt: new Date().toISOString(),
            triggerCount: nextCount,
          });
        } else {
          void updateAlert(user.uid, a.id, {
            triggeredAt: new Date().toISOString(),
            triggerCount: nextCount,
          });
        }
      }
    }, 15000);
    return () => clearInterval(id);
  }, [ticks, push]);

  return null;
}
