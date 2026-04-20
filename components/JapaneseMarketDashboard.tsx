import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { NativeAdSlot } from '@/components/NativeAdCard';
import { UniversalChart, type UniversalChartBar } from '@/components/UniversalChart';
import { fetchFmpQuoteShort, type FmpQuoteShortRow } from '@/services/api/fmpClient';
import { useMarketStore } from '@/store/marketStore';
import { useWalletStore } from '@/store/walletStore';

const ACCENT = '#bf0000';
const PANEL = '#0e0f12';
const LINE = '#23262e';

type WatchRow = { symbol: string; name: string; mockPrice: number; mockPct: number };

const WATCHLIST: WatchRow[] = [
  { symbol: '7203.T', name: 'Toyota', mockPrice: 2850, mockPct: 0.42 },
  { symbol: '6758.T', name: 'Sony', mockPrice: 3820, mockPct: -0.18 },
  { symbol: '9984.T', name: 'SoftBank', mockPrice: 7120, mockPct: 0.65 },
  { symbol: '7974.T', name: 'Nintendo', mockPrice: 10120, mockPct: -0.31 },
];

function buildDemoCandles(barCount: number, seed: number): UniversalChartBar[] {
  const out: UniversalChartBar[] = [];
  const day = 86400;
  let t = Math.floor(Date.now() / 1000) - barCount * day;
  let c = 2800 + (seed % 5) * 40;
  for (let i = 0; i < barCount; i++) {
    const o = c;
    const d = (Math.sin(i / 4 + seed) + ((i % 11) - 5) * 0.15) * 22;
    const h = Math.max(o, c) + Math.abs(d) * 0.35 + 6;
    const l = Math.min(o, c) - Math.abs(d) * 0.35 - 6;
    c = o + d;
    out.push({ time: t, open: o, high: h, low: l, close: c });
    t += day;
  }
  return out;
}

function OrderBookColumn({ side }: { side: 'sell' | 'buy' }) {
  const rows = useMemo(() => {
    const base = side === 'sell' ? 2924.5 : 2923.0;
    const step = side === 'sell' ? 0.5 : -0.5;
    return Array.from({ length: 12 }, (_, i) => ({
      px: base + step * i,
      sz: `${(1.2 + (i % 5) * 0.35).toFixed(2)}`,
    }));
  }, [side]);

  return (
    <View
      className="w-[76px] shrink-0 bg-[#0e0f12] px-1 py-1"
      style={{ borderRightWidth: side === 'sell' ? 1 : 0, borderLeftWidth: side === 'buy' ? 1 : 0, borderColor: LINE }}>
      <Text
        className="mb-1 border-b border-[#23262e] pb-0.5 text-center text-[9px] font-bold text-neutral-500"
        numberOfLines={1}>
        {side === 'sell' ? '売気配' : '買気配'}
      </Text>
      {rows.map((r, i) => (
        <View key={`${side}-${i}`} className="flex-row justify-between py-[2px]">
          <Text
            className={`font-mono text-[9px] tabular-nums ${
              side === 'sell' ? 'text-rose-400/90' : 'text-sky-400/90'
            }`}>
            {r.px.toFixed(1)}
          </Text>
          <Text className="font-mono text-[8px] tabular-nums text-neutral-600">{r.sz}</Text>
        </View>
      ))}
    </View>
  );
}

export function JapaneseMarketDashboard() {
  const formatBaseUsdAsJpy = useWalletStore((s) => s.formatBaseUsdAsJpy);
  const usdToJpy = useWalletStore((s) => s.usdToJpy);
  const mergeLiveQuote = useMarketStore((s) => s.mergeLiveQuote);
  const [quotes, setQuotes] = useState<Record<string, FmpQuoteShortRow>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const chartData = useMemo(() => buildDemoCandles(90, 7), []);

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
      setErr(e instanceof Error ? e.message : 'Quote fetch failed');
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
      className="flex-1 bg-[#0a0b0d]"
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}>
      <View className="border-b px-2 py-1.5" style={{ borderColor: LINE, backgroundColor: PANEL }}>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">口座余力（円）</Text>
            <Text className="text-xl font-bold tabular-nums text-neutral-100">{formatBaseUsdAsJpy()}</Text>
            <Text className="text-[8px] text-neutral-600">USD建て想定 · 為替 {usdToJpy} JPY/USD</Text>
          </View>
          <Pressable
            onPress={() => void refresh()}
            className="rounded border px-2 py-1 active:opacity-80"
            style={{ borderColor: LINE, backgroundColor: '#14161c' }}>
            <Text className="text-[10px] font-bold text-neutral-300">{loading ? '…' : '更新'}</Text>
          </Pressable>
        </View>
        {loading ? <ActivityIndicator className="mt-2" color="#888" /> : null}
        {err ? (
          <Text className="mt-1 text-[9px] text-amber-500/90">FMP: {err} — 気配値はモックです。</Text>
        ) : null}
      </View>

      <View className="border-b px-1 py-1" style={{ borderColor: LINE, backgroundColor: '#08090b' }}>
        <Text className="px-1 pb-0.5 text-[9px] font-bold text-neutral-500">東証プライム · ウォッチ</Text>
        <View style={{ borderColor: LINE }} className="rounded border">
          <View className="flex-row border-b px-1 py-0.5" style={{ borderColor: LINE, backgroundColor: PANEL }}>
            <Text className="w-[26%] text-[8px] font-bold text-neutral-600">銘柄</Text>
            <Text className="w-[30%] text-[8px] font-bold text-neutral-600">名称</Text>
            <Text className="w-[22%] text-right text-[8px] font-bold text-neutral-600">値</Text>
            <Text className="w-[22%] text-right text-[8px] font-bold text-neutral-600">比%</Text>
          </View>
          {WATCHLIST.map((w) => {
            const q = quotes[w.symbol];
            const price = q?.price ?? w.mockPrice;
            const pct = q?.changesPercentage ?? w.mockPct;
            const up = pct >= 0;
            return (
              <View key={w.symbol} className="flex-row border-b px-1 py-1" style={{ borderColor: LINE }}>
                <Text className="w-[26%] text-[10px] font-bold text-neutral-200">{w.symbol}</Text>
                <Text className="w-[30%] text-[9px] text-neutral-500" numberOfLines={1}>
                  {w.name}
                </Text>
                <Text className="w-[22%] text-right text-[10px] font-mono font-bold text-neutral-100">
                  {price.toFixed(0)}
                </Text>
                <Text
                  className="w-[22%] text-right text-[10px] font-mono font-bold"
                  style={{ color: up ? '#f87171' : '#4ade80' }}>
                  {up ? '+' : ''}
                  {pct.toFixed(2)}%
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View className="min-h-[300px] flex-1 flex-row px-0 py-1">
        <OrderBookColumn side="sell" />
        <View className="min-h-[280px] min-w-0 flex-1" style={{ backgroundColor: '#0a0b0d' }}>
          <View className="flex-row items-center justify-between border-b px-1 py-0.5" style={{ borderColor: LINE }}>
            <Text className="text-[9px] font-bold text-neutral-500">チャート · 7203.T</Text>
            <Text className="text-[8px] font-bold" style={{ color: ACCENT }}>
              TradingView engine
            </Text>
          </View>
          <View className="flex-1" style={{ minHeight: 280 }}>
            <UniversalChart data={chartData} colorTheme="dark" market="JAPAN" minHeight={280} />
          </View>
          <View className="border-t px-1 py-2" style={{ borderColor: LINE }}>
            <NativeAdSlot compact />
          </View>
        </View>
        <OrderBookColumn side="buy" />
      </View>

      <View className="mt-1 px-2">
        <Text className="text-[9px] text-neutral-600">
          レイアウトは楽天証券系ターミナルを参考にした高密度モックです。
        </Text>
      </View>

      <View className="px-2 pb-6 pt-2">
        <NativeAdSlot />
      </View>
    </ScrollView>
  );
}
