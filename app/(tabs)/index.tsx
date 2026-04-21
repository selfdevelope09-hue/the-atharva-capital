import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { BannerAd } from '@/src/components/ads/BannerAd';
import { ActiveMarketDashboard } from '@/components/ActiveMarketDashboard';
import { DashboardIdentityHeader } from '@/components/DashboardIdentityHeader';
import { GlobalSettingsModal } from '@/components/GlobalSettingsModal';
import { Leaderboard } from '@/components/Leaderboard';
import { Navbar } from '@/components/Navbar';
import { useMarketStore } from '@/store/marketStore';
import { useThemeStore } from '@/store/themeStore';
import { useBreakpoint } from '@/hooks/useBreakpoint';

export default function GlobalMarketHome() {
  const { isNavRail: isWide } = useBreakpoint();
  const activeMarket = useMarketStore((s) => s.activeMarket);
  const palette = useThemeStore((s) => s.palette);

  const [indiaWatchlistOpen, setIndiaWatchlistOpen] = useState(false);

  const onIndiaWatchlistOpenChange = useCallback((open: boolean) => {
    setIndiaWatchlistOpen(open);
  }, []);

  useEffect(() => {
    if (activeMarket !== 'INDIA') {
      setIndiaWatchlistOpen(false);
    }
  }, [activeMarket]);

  return (
    <View className="flex-1 font-sans" style={{ backgroundColor: palette.bg }}>
      <Navbar
        isWide={isWide}
        showWatchlistTrigger={activeMarket === 'INDIA' && !isWide}
        onOpenWatchlist={() => setIndiaWatchlistOpen(true)}
      />

      {/* Top banner — above the market content */}
      <BannerAd slot="top" />

      <ScrollView
        className="min-h-0 flex-1"
        nestedScrollEnabled
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}>
        <DashboardIdentityHeader />
        <View style={{ minHeight: 420 }}>
          <ActiveMarketDashboard
            market={activeMarket}
            isWide={isWide}
            indiaWatchlistOpen={indiaWatchlistOpen}
            onIndiaWatchlistOpenChange={onIndiaWatchlistOpenChange}
          />
        </View>
        {/* Bottom banner — below the market content */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <BannerAd slot="bottom" />
        </View>
      </ScrollView>

      <ScrollView
        className="max-h-[280px] shrink-0 border-t"
        style={{ borderTopColor: palette.border }}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}>
        <Leaderboard />
      </ScrollView>

      <GlobalSettingsModal />
    </View>
  );
}
