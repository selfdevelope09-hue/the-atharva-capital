import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { NativeAdSlot } from '@/components/NativeAdCard';
import { UniversalChart, type UniversalChartBar } from '@/components/UniversalChart';
import { fetchFmpQuoteShort, type FmpQuoteShortRow } from '@/services/api/fmpClient';
import { useMarketStore } from '@/store/marketStore';
import { useWalletStore } from '@/store/walletStore';

/** Wealthsimple-inspired: soft pastels, generous radius, calm typography */
const BG = '#0c0c0f';
const CARD = '#15151c';
const LEMON = '#fde68a';
const LILAC = '#c4b5fd';

type WatchRow = { symbol: string; name: string; mock: number; mockPct: number };

const WATCHLIST: WatchRow[] = [
  { symbol: 'SHOP.TO', name: 'Shopify', mock: 118.4, mockPct: 0.42 },
  { symbol: 'RY.TO', name: 'Royal Bank of Canada', mock: 142.2, mockPct: -0.08 },
  { symbol: 'TD.TO', name: 'TD Bank', mock: 88.6, mockPct: 0.11 },
  { symbol: 'ENB.TO', name: 'Enbridge', mock: 54.3, mockPct: -0.19 },
];

function buildDemoCandles(barCount: number, seed: number): UniversalChartBar[] {
  const out: UniversalChartBar[] = [];
  const day = 86400;
  let t = Math.floor(Date.now() / 1000) - barCount * day;
  let c = 105 + (seed % 5);
  for (let i = 0; i < barCount; i++) {
    const o = c;
    const d = (Math.sin(i / 4 + seed * 0.06) + ((i % 8) - 3.5) * 0.11) * 1.8;
    const h = Math.max(o, c) + Math.abs(d) * 0.25 + 0.5;
    const l = Math.min(o, c) - Math.abs(d) * 0.25 - 0.5;
    c = Math.max(0.5, o + d);
    out.push({ time: t, open: o, high: h, low: l, close: c });
    t += day;
  }
  return out;
}

export function CanadianMarketDashboard() {
  const formatBaseUsdAsCad = useWalletStore((s) => s.formatBaseUsdAsCad);
  const usdToCad = useWalletStore((s) => s.usdToCad);
  const mergeLiveQuote = useMarketStore((s) => s.mergeLiveQuote);
  const [quotes, setQuotes] = useState<Record<string, FmpQuoteShortRow>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const chartData = useMemo(() => buildDemoCandles(88, 23), []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const rows = await fetchFmpQuoteShort(WATCHLIST.map((w) => w.symbol));
      const map: Record<string, FmpQuoteShortRow> = {};
      rows.forEach((r) => {
        map[r.symbol] = r;
        mergeLiveQuote(r.symbol, r.price, Number(r.changesPercentage ?? 0), 'FMP');
      });
      setQuotes(map);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'FMP failed');
      setQuotes({});
    } finally {
      setLoading(false);
    }
  }, [mergeLiveQuote]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: BG }}
      contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 22, paddingTop: 28 }}
      showsVerticalScrollIndicator={false}>
      <Text className="text-center text-sm font-medium tracking-wide text-neutral-500">Total balance</Text>
      <Text
        className="mt-4 text-center font-semibold text-white"
        style={{ fontSize: 40, letterSpacing: -0.5, lineHeight: 44 }}>
        {formatBaseUsdAsCad()}
      </Text>
      <Text className="mt-3 text-center text-sm text-neutral-500">
        Virtual · USD notional shown in CAD ({usdToCad.toFixed(2)} CAD/USD)
      </Text>

      <View className="mt-10 overflow-hidden rounded-[28px] p-5" style={{ backgroundColor: CARD }}>
        <Text className="text-lg font-semibold text-white">Your portfolio</Text>
        <Text className="mt-1 text-sm text-neutral-500">TSX focus · mock history</Text>
        <View className="mt-5 overflow-hidden rounded-2xl" style={{ marginHorizontal: -8 }}>
          <UniversalChart
            data={chartData}
            colorTheme="dark"
            market="CANADA"
            minHeight={260}
            seriesPresentation="softArea"
          />
        </View>

        <View className="mt-8 rounded-2xl px-1 py-2" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
          <NativeAdSlot />
        </View>
      </View>

      <View className="mt-10">
        <View className="mb-4 flex-row items-center justify-between px-1">
          <Text className="text-lg font-semibold text-white">Investments</Text>
          <Pressable onPress={() => void refresh()} className="rounded-full px-3 py-2 active:opacity-70">
            <Text className="text-sm font-medium" style={{ color: LILAC }}>
              {loading ? '…' : 'Refresh'}
            </Text>
          </Pressable>
        </View>
        {err ? <Text className="mb-2 text-sm text-amber-200/80">{err} — mock prices.</Text> : null}
        {loading ? <ActivityIndicator color={LEMON} className="mb-4" /> : null}

        {WATCHLIST.map((w) => {
          const q = quotes[w.symbol];
          const px = q?.price ?? w.mock;
          const pct = q?.changesPercentage ?? w.mockPct;
          const up = pct >= 0;
          return (
            <View
              key={w.symbol}
              className="mb-4 rounded-[22px] px-5 py-5"
              style={{ backgroundColor: CARD }}>
              <View className="flex-row items-center justify-between">
                <View className="min-w-0 flex-1 pr-4">
                  <Text className="text-base font-semibold text-white">{w.symbol}</Text>
                  <Text className="mt-1 text-sm text-neutral-500" numberOfLines={2}>
                    {w.name}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-lg font-medium tabular-nums text-white">
                    {px.toLocaleString('en-CA', { maximumFractionDigits: 2 })}
                  </Text>
                  <View
                    className="mt-2 rounded-full px-2.5 py-1"
                    style={{
                      backgroundColor: up ? 'rgba(253, 230, 138, 0.15)' : 'rgba(196, 181, 253, 0.12)',
                    }}>
                    <Text
                      className="text-xs font-semibold tabular-nums"
                      style={{ color: up ? LEMON : LILAC }}>
                      {up ? '+' : ''}
                      {pct.toFixed(2)}%
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
