import { lazy, memo, Suspense, useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import type { ActiveMarket } from '@/store/marketStore';

const IndiaMarketDashboardLazy = lazy(() =>
  import('@/components/IndiaMarketDashboard').then((m) => ({ default: m.IndiaMarketDashboard }))
);
const USMarketDashboardLazy = lazy(() =>
  import('@/components/USMarketDashboard').then((m) => ({ default: m.USMarketDashboard }))
);
const ChineseMarketDashboardLazy = lazy(() =>
  import('@/components/ChineseMarketDashboard').then((m) => ({ default: m.ChineseMarketDashboard }))
);
const JapaneseMarketDashboardLazy = lazy(() =>
  import('@/components/JapaneseMarketDashboard').then((m) => ({ default: m.JapaneseMarketDashboard }))
);
const UKMarketDashboardLazy = lazy(() =>
  import('@/components/UKMarketDashboard').then((m) => ({ default: m.UKMarketDashboard }))
);
const AusMarketDashboardLazy = lazy(() =>
  import('@/components/AusMarketDashboard').then((m) => ({ default: m.AusMarketDashboard }))
);
const GermanMarketDashboardLazy = lazy(() =>
  import('@/components/GermanMarketDashboard').then((m) => ({ default: m.GermanMarketDashboard }))
);
const CanadianMarketDashboardLazy = lazy(() =>
  import('@/components/CanadianMarketDashboard').then((m) => ({ default: m.CanadianMarketDashboard }))
);
const SwissMarketDashboardLazy = lazy(() =>
  import('@/components/SwissMarketDashboard').then((m) => ({ default: m.SwissMarketDashboard }))
);
const CryptoMarketDashboardLazy = lazy(() =>
  import('@/components/CryptoMarketDashboard').then((m) => ({ default: m.CryptoMarketDashboard }))
);

const MarketFallback = memo(function MarketFallback() {
  return (
    <View className="min-h-0 flex-1 items-center justify-center bg-[#0a0a0a] px-6">
      <ActivityIndicator size="large" color="#737373" />
      <Text className="mt-4 text-center text-sm text-neutral-500">Loading market…</Text>
    </View>
  );
});

export type ActiveMarketDashboardProps = {
  market: ActiveMarket;
  isWide: boolean;
  indiaWatchlistOpen: boolean;
  onIndiaWatchlistOpenChange: (open: boolean) => void;
};

/**
 * Renders **only** the active market route. Inactive venues fully unmount (no hidden trees).
 * `React.lazy` splits bundles so idle markets are not eagerly evaluated until first open.
 */
function ActiveMarketDashboardInner({
  market,
  isWide,
  indiaWatchlistOpen,
  onIndiaWatchlistOpenChange,
}: ActiveMarketDashboardProps) {
  const panel = useMemo(() => {
    switch (market) {
      case 'INDIA':
        return (
          <IndiaMarketDashboardLazy
            isWide={isWide}
            watchlistOpen={indiaWatchlistOpen}
            onWatchlistOpenChange={onIndiaWatchlistOpenChange}
          />
        );
      case 'US':
        return <USMarketDashboardLazy />;
      case 'CHINA':
        return <ChineseMarketDashboardLazy />;
      case 'JAPAN':
        return <JapaneseMarketDashboardLazy />;
      case 'UK':
        return <UKMarketDashboardLazy isWide={isWide} />;
      case 'AUSTRALIA':
        return <AusMarketDashboardLazy />;
      case 'GERMANY':
        return <GermanMarketDashboardLazy />;
      case 'CANADA':
        return <CanadianMarketDashboardLazy />;
      case 'SWITZERLAND':
        return <SwissMarketDashboardLazy isWide={isWide} />;
      case 'CRYPTO':
        return <CryptoMarketDashboardLazy />;
      default:
        return null;
    }
  }, [market, isWide, indiaWatchlistOpen, onIndiaWatchlistOpenChange]);

  return (
    <Suspense key={market} fallback={<MarketFallback />}>
      {panel}
    </Suspense>
  );
}

export const ActiveMarketDashboard = memo(ActiveMarketDashboardInner);
