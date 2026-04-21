import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { NativeAdSlot } from '@/components/NativeAdCard';
import { UniversalChart, type UniversalChartBar } from '@/components/UniversalChart';
import { fetchYahooBatch, type YahooQuote } from '@/src/services/yahooFinance';
import { calcChangePct } from '@/src/services/MarketDataService';
import { useWalletStore } from '@/store/walletStore';

type WatchRow = { symbol: string; name: string; mock: number; mockPct: number };

const WATCHLIST: WatchRow[] = [
  { symbol: 'SAP.DE', name: 'SAP SE', mock: 188.2, mockPct: 0.14 },
  { symbol: 'SIE.DE', name: 'Siemens', mock: 204.5, mockPct: -0.09 },
  { symbol: 'ALV.DE', name: 'Allianz', mock: 312.4, mockPct: 0.21 },
  { symbol: 'VOW3.DE', name: 'Volkswagen', mock: 118.9, mockPct: -0.33 },
];

function buildDemoCandles(barCount: number, seed: number): UniversalChartBar[] {
  const out: UniversalChartBar[] = [];
  const day = 86400;
  let t = Math.floor(Date.now() / 1000) - barCount * day;
  let c = 185 + (seed % 6);
  for (let i = 0; i < barCount; i++) {
    const o = c;
    const d = (Math.sin(i / 5 + seed * 0.07) + ((i % 10) - 4.5) * 0.09) * 2.2;
    const h = Math.max(o, c) + Math.abs(d) * 0.4 + 1;
    const l = Math.min(o, c) - Math.abs(d) * 0.4 - 1;
    c = Math.max(1, o + d);
    out.push({ time: t, open: o, high: h, low: l, close: c });
    t += day;
  }
  return out;
}

/** Trade Republic–inspired: #000 canvas, hairlines, oversized balance */
export function GermanMarketDashboard() {
  const { width: screenW } = useWindowDimensions();
  const formatBaseUsdAsEur = useWalletStore((s) => s.formatBaseUsdAsEur);
  const usdToEur = useWalletStore((s) => s.usdToEur);
  const [quotes, setQuotes] = useState<Record<string, YahooQuote>>({});
  const [loading, setLoading] = useState(false);
  const chartData = useMemo(() => buildDemoCandles(78, 19), []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const map = await fetchYahooBatch(WATCHLIST.map((w) => w.symbol));
      setQuotes(map);
    } catch {
      // keep previous quotes on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: '#000000' }}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}>
      <View className="items-center px-6 pt-10">
        <Text className="text-center text-[11px] font-medium uppercase tracking-[0.35em] text-neutral-600">
          Portfolio
        </Text>
        <Text
          className="mt-3 text-center text-white"
          style={styles.heroBalance}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}>
          {formatBaseUsdAsEur()}
        </Text>
        <Text className="mt-4 text-center text-[12px] text-neutral-600">
          Virtual · USD @ {usdToEur.toFixed(2)} €/$
        </Text>
        <Pressable onPress={() => void refresh()} className="mt-6 active:opacity-60" hitSlop={12}>
          <Text className="text-xs font-medium text-neutral-500">{loading ? '…' : 'Refresh prices'}</Text>
        </Pressable>
      </View>


      <View className="mt-12">
        <Text className="mb-4 px-6 text-[11px] font-medium uppercase tracking-widest text-neutral-600">
          DAX
        </Text>
        {WATCHLIST.flatMap((w, index) => {
          const q = quotes[w.symbol];
          const px = q?.price ?? w.mock;
          const pct = calcChangePct(q, w.mockPct);
          const up = pct >= 0;
          const row = (
            <View key={w.symbol} style={styles.rowHairline}>
              <View className="flex-row items-baseline justify-between px-6 py-5">
                <View className="min-w-0 flex-1 pr-4">
                  <Text className="text-base font-medium text-white">{w.symbol}</Text>
                  <Text className="mt-1 text-sm text-neutral-600" numberOfLines={1}>
                    {w.name}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-lg font-light tabular-nums text-white">
                    {px.toLocaleString('de-DE', { maximumFractionDigits: 2 })}
                  </Text>
                  <Text
                    className="mt-1 text-sm font-medium tabular-nums"
                    style={{ color: up ? '#a3a3a3' : '#737373' }}>
                    {up ? '+' : ''}
                    {pct.toFixed(2)}%
                  </Text>
                </View>
              </View>
            </View>
          );
          if (index === 1) {
            return [
              row,
              <View key="ad-inline" className="px-6 py-4">
                <NativeAdSlot variant="minimal" compact />
              </View>,
            ];
          }
          return [row];
        })}
      </View>

      <View className="mt-10" style={{ width: screenW, alignSelf: 'center' }}>
        <UniversalChart data={chartData} colorTheme="dark" market="GERMANY" minHeight={280} />
      </View>

      <View className="mt-10 px-6">
        <NativeAdSlot variant="minimal" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heroBalance: {
    fontSize: 52,
    fontWeight: '200',
    letterSpacing: -1.5,
    lineHeight: 56,
  },
  rowHairline: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
});
