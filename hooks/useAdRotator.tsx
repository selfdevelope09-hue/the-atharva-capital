import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { fetchNextAd, type NativeAd } from '@/services/ads/AdAggregator';

const ROTATION_MS = 30_000;

const AdRotationContext = createContext<NativeAd | null>(null);

export function AdRotatorProvider({ children }: { children: React.ReactNode }) {
  const [ad, setAd] = useState<NativeAd>(() => fetchNextAd());

  useEffect(() => {
    const id = setInterval(() => {
      setAd(fetchNextAd());
    }, ROTATION_MS);
    return () => clearInterval(id);
  }, []);

  const value = useMemo(() => ad, [ad]);

  return <AdRotationContext.Provider value={value}>{children}</AdRotationContext.Provider>;
}

/** Current aggregated native ad; updates every 30s while the tabs layout is mounted. */
export function useAdRotator(): NativeAd {
  const ctx = useContext(AdRotationContext);
  if (!ctx) {
    throw new Error('useAdRotator must be used within AdRotatorProvider (wrap app/(tabs)/_layout).');
  }
  return ctx;
}
