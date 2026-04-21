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
import { fetchYahooBatch, type YahooQuote } from '@/src/services/yahooFinance';
import { calcChangePct } from '@/src/services/MarketDataService';
import { useWalletStore } from '@/store/walletStore';

/** CommSec-inspired palette: trusted corporate, muted gold + teal on deep navy */
const BG = '#0a1424';
const PANEL = '#0f1c30';
const LINE = '#1e3550';
const GOLD = '#b89a4a';
const GOLD_DIM = 'rgba(184, 154, 74, 0.35)';
const TEAL = '#2d9d8f';

type WatchRow = { symbol: string; name: string; mock: number; mockPct: number };

const WATCHLIST: WatchRow[] = [
  { symbol: 'BHP.AX', name: 'BHP Group', mock: 42.18, mockPct: 0.31 },
  { symbol: 'CBA.AX', name: 'Commonwealth Bank', mock: 118.4, mockPct: -0.12 },
  { symbol: 'CSL.AX', name: 'CSL', mock: 278.5, mockPct: 0.08 },
  { symbol: 'MQG.AX', name: 'Macquarie Group', mock: 198.2, mockPct: 0.22 },
];

type YieldRow = {
  symbol: string;
  name: string;
  yieldPct: number;
  franked?: string;
};

/** Dividend emphasis — mock yields (CommSec-style “Top yielders”). */
const TOP_YIELDERS: YieldRow[] = [
  { symbol: 'WBC.AX', name: 'Westpac', yieldPct: 6.8, franked: '100% franked' },
  { symbol: 'NAB.AX', name: 'NAB', yieldPct: 6.2, franked: '100% franked' },
  { symbol: 'TLS.AX', name: 'Telstra', yieldPct: 4.9, franked: 'Partial' },
  { symbol: 'STO.AX', name: 'Santos', yieldPct: 4.4 },
  { symbol: 'ORG.AX', name: 'Origin Energy', yieldPct: 5.1 },
  { symbol: 'WOW.AX', name: 'Woolworths', yieldPct: 2.8, franked: '100% franked' },
];

function buildDemoCandles(barCount: number, seed: number): UniversalChartBar[] {
  const out: UniversalChartBar[] = [];
  const day = 86400;
  let t = Math.floor(Date.now() / 1000) - barCount * day;
  let c = 44 + (seed % 8);
  for (let i = 0; i < barCount; i++) {
    const o = c;
    const d = (Math.sin(i / 4 + seed * 0.08) + ((i % 11) - 5) * 0.11) * 1.4;
    const h = Math.max(o, c) + Math.abs(d) * 0.35 + 0.6;
    const l = Math.min(o, c) - Math.abs(d) * 0.35 - 0.6;
    c = Math.max(0.4, o + d);
    out.push({ time: t, open: o, high: h, low: l, close: c });
    t += day;
  }
  return out;
}

export function AusMarketDashboard() {
  const formatBaseUsdAsAud = useWalletStore((s) => s.formatBaseUsdAsAud);
  const usdToAud = useWalletStore((s) => s.usdToAud);
  const [quotes, setQuotes] = useState<Record<string, YahooQuote>>({});
  const [loading, setLoading] = useState(false);
  const chartData = useMemo(() => buildDemoCandles(80, 11), []);

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
      style={{ backgroundColor: BG }}
      contentContainerStyle={{ paddingBottom: 28, paddingHorizontal: 14, paddingTop: 12 }}
      showsVerticalScrollIndicator={false}>
      <View className="mb-4 rounded-xl border px-4 py-4" style={{ borderColor: LINE, backgroundColor: PANEL }}>
        <Text className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: TEAL }}>
          CommSec · NetBank view (mock)
        </Text>
        <Text className="mt-2 text-2xl font-bold text-white">Cash balance</Text>
        <Text className="mt-1 text-3xl font-semibold tabular-nums text-white">{formatBaseUsdAsAud()}</Text>
        <Text className="mt-2 text-xs text-neutral-500">
          Virtual USD notional shown in AUD @ {usdToAud.toFixed(2)} AUD/USD
        </Text>
      </View>

      <View className="mb-1 flex-row items-center justify-between px-1">
        <Text className="text-sm font-bold text-white">ASX watchlist</Text>
        <Pressable
          onPress={() => void refresh()}
          className="rounded-lg border px-3 py-1.5 active:opacity-80"
          style={{ borderColor: GOLD_DIM, backgroundColor: '#132238' }}>
          <Text className="text-xs font-bold" style={{ color: GOLD }}>
            {loading ? '…' : 'Refresh'}
          </Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator className="my-2" color={TEAL} /> : null}

      <View className="rounded-xl border" style={{ borderColor: LINE, backgroundColor: PANEL }}>
        {WATCHLIST.map((w) => {
          const q = quotes[w.symbol];
          const px = q?.price ?? w.mock;
          const pct = calcChangePct(q, w.mockPct);
          const up = pct >= 0;
          return (
            <View
              key={w.symbol}
              className="flex-row items-center justify-between border-b px-3 py-3"
              style={{ borderColor: LINE }}>
              <View>
                <Text className="text-sm font-bold text-white">{w.symbol}</Text>
                <Text className="text-[11px] text-neutral-500">{w.name}</Text>
              </View>
              <View className="items-end">
                <Text className="text-base font-semibold tabular-nums text-white">{px.toFixed(2)}</Text>
                <Text
                  className="text-xs font-bold tabular-nums"
                  style={{ color: up ? TEAL : '#c97a7a' }}>
                  {up ? '+' : ''}
                  {pct.toFixed(2)}%
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <Text className="mb-2 mt-6 px-1 text-sm font-bold text-white">Top yielders</Text>
      <Text className="mb-3 px-1 text-[11px] text-neutral-500">
        Indicative trailing yields — illustrative only (not advice).
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1 pb-1">
        <View className="flex-row gap-3 px-1">
          {TOP_YIELDERS.map((y) => (
            <View
              key={y.symbol}
              className="w-[158px] rounded-xl border px-3 py-3"
              style={{ borderColor: GOLD_DIM, backgroundColor: '#121f34' }}>
              <Text className="text-xs font-bold text-white">{y.symbol}</Text>
              <Text className="mt-1 text-[10px] text-neutral-500" numberOfLines={1}>
                {y.name}
              </Text>
              <Text className="mt-3 text-2xl font-black tabular-nums" style={{ color: GOLD }}>
                {y.yieldPct.toFixed(1)}%
              </Text>
              <Text className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
                Est. yield p.a.
              </Text>
              {y.franked ? (
                <View className="mt-2 rounded-md px-2 py-1" style={{ backgroundColor: 'rgba(45,157,143,0.15)' }}>
                  <Text className="text-[9px] font-bold" style={{ color: TEAL }}>
                    {y.franked}
                  </Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>

      <View className="mt-8 rounded-xl border px-3 py-3" style={{ borderColor: LINE, backgroundColor: PANEL }}>
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: TEAL }}>
            Chart · BHP.AX
          </Text>
          <Text className="text-[10px] font-semibold" style={{ color: GOLD }}>
            TradingView
          </Text>
        </View>
        <View className="min-h-[260px] overflow-hidden rounded-lg">
          <UniversalChart data={chartData} colorTheme="dark" market="AUSTRALIA" minHeight={260} />
        </View>
      </View>

      <View className="mt-6 px-1">
        <NativeAdSlot />
      </View>
    </ScrollView>
  );
}
