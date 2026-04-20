import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { NativeAdSlot } from '@/components/NativeAdCard';
import { UniversalChart, type UniversalChartBar } from '@/components/UniversalChart';
import { fetchFmpQuoteShort, type FmpQuoteShortRow } from '@/services/api/fmpClient';
import { useMarketStore } from '@/store/marketStore';
import { useWalletStore } from '@/store/walletStore';

const BG = '#06060a';
const CARD = '#0f1018';
const NEON_BLUE = '#00d9ff';
const NEON_ORANGE = '#ff7a18';
const LINE = 'rgba(0,217,255,0.25)';

/** Mock pie weights — Trading 212 “pie” style allocation. */
const PIE_SLICES: {
  symbol: string;
  name: string;
  weight: number;
  color: string;
}[] = [
  { symbol: 'SHEL.L', name: 'Shell', weight: 0.4, color: NEON_BLUE },
  { symbol: 'HSBA.L', name: 'HSBC', weight: 0.3, color: NEON_ORANGE },
  { symbol: 'AZN.L', name: 'AstraZeneca', weight: 0.3, color: '#e879f9' },
];

const WATCHLIST: { symbol: string; name: string; mock: number; mockPct: number }[] = [
  { symbol: 'SHEL.L', name: 'Shell', mock: 28.4, mockPct: 0.22 },
  { symbol: 'AZN.L', name: 'AstraZeneca', mock: 112.6, mockPct: -0.15 },
  { symbol: 'HSBA.L', name: 'HSBC', mock: 7.42, mockPct: 0.08 },
  { symbol: 'ULVR.L', name: 'Unilever', mock: 42.1, mockPct: 0.05 },
  { symbol: 'BP.L', name: 'BP', mock: 3.92, mockPct: -0.31 },
];

function hashSymbol(s: string): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 97;
}

function buildDemoCandles(barCount: number, seed: number): UniversalChartBar[] {
  const out: UniversalChartBar[] = [];
  const day = 86400;
  let t = Math.floor(Date.now() / 1000) - barCount * day;
  let c = 50 + (seed % 20);
  for (let i = 0; i < barCount; i++) {
    const o = c;
    const d = (Math.sin(i / 5 + seed * 0.1) + ((i % 9) - 4) * 0.12) * 1.8;
    const h = Math.max(o, c) + Math.abs(d) * 0.4 + 0.8;
    const l = Math.min(o, c) - Math.abs(d) * 0.4 - 0.8;
    c = Math.max(0.5, o + d);
    out.push({ time: t, open: o, high: h, low: l, close: c });
    t += day;
  }
  return out;
}

function sectorDonutPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  a0: number,
  a1: number
): string {
  const p = (r: number, a: number) => ({
    x: cx + r * Math.cos(a),
    y: cy + r * Math.sin(a),
  });
  const o1 = p(rOuter, a0);
  const o2 = p(rOuter, a1);
  const i2 = p(rInner, a1);
  const i1 = p(rInner, a0);
  const sweep = a1 - a0;
  const large = Math.abs(sweep) > Math.PI ? 1 : 0;
  const sweepFlag = sweep >= 0 ? 1 : 0;
  const innerSweep = sweep >= 0 ? 0 : 1;
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} ${sweepFlag} ${o2.x} ${o2.y}`,
    `L ${i2.x} ${i2.y}`,
    `A ${rInner} ${rInner} 0 ${large} ${innerSweep} ${i1.x} ${i1.y}`,
    'Z',
  ].join(' ');
}

type PortfolioPieDonutProps = {
  size: number;
  onSlicePress: (symbol: string) => void;
};

function PortfolioPieDonut({ size, onSlicePress }: PortfolioPieDonutProps) {
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.42;
  const rInner = size * 0.26;
  let angle = -Math.PI / 2;
  const paths = PIE_SLICES.map((slice) => {
    const sweep = slice.weight * Math.PI * 2;
    const a0 = angle;
    const a1 = angle + sweep;
    const d = sectorDonutPath(cx, cy, rOuter, rInner, a0, a1);
    angle = a1;
    return { d, color: slice.color, symbol: slice.symbol, key: slice.symbol };
  });

  return (
    <View
      className="items-center justify-center"
      style={{ width: size, height: size, position: 'relative' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {paths.map((p) => (
          <Path
            key={p.key}
            d={p.d}
            fill={p.color}
            onPress={() => onSlicePress(p.symbol)}
          />
        ))}
      </Svg>
      <View
        className="absolute items-center justify-center rounded-full"
        style={{
          width: rInner * 2 + 8,
          height: rInner * 2 + 8,
          backgroundColor: '#0a0b12',
          borderWidth: 2,
          borderColor: LINE,
          pointerEvents: 'none',
        }}>
        <Text className="text-[10px] font-bold uppercase tracking-widest" style={{ color: NEON_BLUE }}>
          Pie
        </Text>
        <Text className="text-xs font-black text-neutral-200">Virtual ISA</Text>
      </View>
    </View>
  );
}

type UKMarketDashboardProps = {
  isWide: boolean;
};

export function UKMarketDashboard({ isWide }: UKMarketDashboardProps) {
  const formatBaseUsdAsGbp = useWalletStore((s) => s.formatBaseUsdAsGbp);
  const usdToGbp = useWalletStore((s) => s.usdToGbp);
  const mergeLiveQuote = useMarketStore((s) => s.mergeLiveQuote);
  const [quotes, setQuotes] = useState<Record<string, FmpQuoteShortRow>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);

  const chartData = useMemo(
    () => (chartSymbol ? buildDemoCandles(72, hashSymbol(chartSymbol)) : []),
    [chartSymbol]
  );

  const chartTitle = useMemo(() => {
    if (!chartSymbol) return '';
    const row = WATCHLIST.find((w) => w.symbol === chartSymbol);
    const pie = PIE_SLICES.find((p) => p.symbol === chartSymbol);
    return row?.name ?? pie?.name ?? chartSymbol;
  }, [chartSymbol]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const syms = WATCHLIST.map((w) => w.symbol);
      const rows = await fetchFmpQuoteShort(syms);
      const map: Record<string, FmpQuoteShortRow> = {};
      rows.forEach((r) => {
        map[r.symbol] = r;
        mergeLiveQuote(r.symbol, r.price, Number(r.changesPercentage ?? 0), 'FMP');
      });
      setQuotes(map);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'FMP request failed');
      setQuotes({});
    } finally {
      setLoading(false);
    }
  }, [mergeLiveQuote]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const chartPanel = chartSymbol ? (
    <View
      className="flex-1 rounded-3xl border p-3"
      style={{
        borderColor: LINE,
        backgroundColor: CARD,
        minHeight: 320,
        minWidth: isWide ? 300 : undefined,
      }}>
      <View className="mb-2 flex-row items-center justify-between">
        <View>
          <Text className="text-[10px] font-bold uppercase tracking-wide" style={{ color: NEON_ORANGE }}>
            Chart
          </Text>
          <Text className="text-base font-black text-white">
            {chartSymbol} · {chartTitle}
          </Text>
        </View>
        <Pressable
          onPress={() => setChartSymbol(null)}
          className="rounded-full border px-3 py-1.5 active:opacity-80"
          style={{ borderColor: LINE, backgroundColor: '#141622' }}>
          <Text className="text-xs font-bold" style={{ color: NEON_BLUE }}>
            Close
          </Text>
        </Pressable>
      </View>
      <View className="min-h-[280px] flex-1 overflow-hidden rounded-2xl">
        <UniversalChart data={chartData} colorTheme="dark" market="UK" symbol={chartSymbol} minHeight={280} />
      </View>
      <View className="mt-3">
        <NativeAdSlot compact />
      </View>
    </View>
  ) : null;

  const mainScroll = (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: BG }}
      contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: 16, paddingTop: 12 }}
      showsVerticalScrollIndicator={false}>
      <View
        className="mb-5 rounded-3xl border px-5 py-5"
        style={{ borderColor: LINE, backgroundColor: CARD, borderWidth: 1.5 }}>
        <Text className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: NEON_BLUE }}>
          Free funds
        </Text>
        <Text className="mt-2 text-3xl font-black text-white">{formatBaseUsdAsGbp()}</Text>
        <Text className="mt-1 text-xs text-neutral-500">
          USD notional → GBP @ {usdToGbp.toFixed(2)} £ per $1
        </Text>
      </View>

      <Text className="mb-3 text-lg font-black text-white">Invest Pies</Text>

      <View
        className="mb-6 items-center rounded-[28px] border px-4 py-8"
        style={{ borderColor: 'rgba(255,122,24,0.35)', backgroundColor: CARD }}>
        <Text className="mb-4 text-center text-sm font-bold text-neutral-400">LSE core pie (mock)</Text>
        <PortfolioPieDonut size={220} onSlicePress={(sym) => setChartSymbol(sym)} />
        <Text className="mt-5 text-center text-xs text-neutral-500">
          Tap a slice to open the chart {isWide ? '→' : '↓'}
        </Text>
      </View>

      <Text className="mb-2 text-base font-black text-white">Holdings</Text>
      <View className="mb-6 rounded-3xl border p-3" style={{ borderColor: LINE, backgroundColor: CARD }}>
        {PIE_SLICES.map((h) => (
          <Pressable
            key={h.symbol}
            onPress={() => setChartSymbol(h.symbol)}
            className="mb-2 flex-row items-center justify-between rounded-2xl px-3 py-3 active:opacity-90"
            style={{ backgroundColor: '#141622' }}>
            <View className="flex-row items-center gap-3">
              <View className="h-3 w-3 rounded-full" style={{ backgroundColor: h.color }} />
              <View>
                <Text className="text-sm font-bold text-white">{h.name}</Text>
                <Text className="text-[11px] text-neutral-500">{h.symbol}</Text>
              </View>
            </View>
            <Text className="text-lg font-black tabular-nums" style={{ color: NEON_ORANGE }}>
              {(h.weight * 100).toFixed(0)}%
            </Text>
          </Pressable>
        ))}
      </View>

      <Text className="mb-2 text-base font-black text-white">LSE watchlist</Text>
      <View className="rounded-3xl border p-2" style={{ borderColor: LINE, backgroundColor: CARD }}>
        {loading ? <ActivityIndicator className="py-4" color={NEON_BLUE} /> : null}
        {err ? (
          <Text className="px-2 py-2 text-center text-xs text-amber-400/90">{err} — mock prices shown.</Text>
        ) : null}
        {WATCHLIST.map((w) => {
          const q = quotes[w.symbol];
          const px = q?.price ?? w.mock;
          const pct = q?.changesPercentage ?? w.mockPct;
          const up = pct >= 0;
          return (
            <Pressable
              key={w.symbol}
              onPress={() => setChartSymbol(w.symbol)}
              className="mb-1 flex-row items-center justify-between rounded-2xl px-3 py-3 active:bg-white/5">
              <View>
                <Text className="text-sm font-bold text-white">{w.symbol}</Text>
                <Text className="text-[11px] text-neutral-500">{w.name}</Text>
              </View>
              <View className="items-end">
                <Text className="text-sm font-black tabular-nums text-white">{px.toFixed(2)}</Text>
                <Text
                  className="text-xs font-bold tabular-nums"
                  style={{ color: up ? NEON_BLUE : NEON_ORANGE }}>
                  {up ? '+' : ''}
                  {pct.toFixed(2)}%
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View className="mt-4 px-1">
        <NativeAdSlot />
      </View>

      <Pressable
        onPress={() => void refresh()}
        className="mt-6 self-center rounded-full border px-6 py-3 active:opacity-90"
        style={{ borderColor: NEON_ORANGE, backgroundColor: 'rgba(255,122,24,0.12)' }}>
        <Text className="text-sm font-black" style={{ color: NEON_ORANGE }}>
          Refresh quotes (FMP)
        </Text>
      </Pressable>
    </ScrollView>
  );

  if (isWide) {
    return (
      <View className="flex-1 flex-row" style={{ backgroundColor: BG }}>
        <View className="min-w-0 flex-1">{mainScroll}</View>
        {chartSymbol ? (
          <View className="border-l p-3" style={{ width: '44%', maxWidth: 520, borderColor: LINE }}>
            {chartPanel}
          </View>
        ) : (
          <View
            className="justify-between border-l p-4"
            style={{ width: '38%', maxWidth: 420, borderColor: LINE }}>
            <Text className="text-center text-sm text-neutral-500">
              Select a pie slice, holding, or watchlist row to load the TradingView chart here.
            </Text>
            <View className="mt-6">
              <NativeAdSlot compact />
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: BG }}>
      {mainScroll}
      <Modal
        visible={!!chartSymbol}
        animationType="slide"
        transparent
        onRequestClose={() => setChartSymbol(null)}>
        <View className="flex-1 bg-black/70">
          <Pressable
            className="flex-1"
            onPress={() => setChartSymbol(null)}
            accessibilityRole="button"
            accessibilityLabel="Close chart"
          />
          <View
            className="max-h-[88%] rounded-t-[28px] border-t border-l border-r p-4"
            style={{ borderColor: LINE, backgroundColor: '#0a0b12' }}>
            {chartPanel}
          </View>
        </View>
      </Modal>
    </View>
  );
}
