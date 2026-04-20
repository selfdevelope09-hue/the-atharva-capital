import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { NativeAdSlot } from '@/components/NativeAdCard';
import {
  changePctFromSina,
  fetchSinaQuotes,
  type SinaParsedQuote,
} from '@/services/api/sinaFinanceClient';
import { useWalletStore } from '@/store/walletStore';

/** China mainland / HK convention: RED = up, GREEN = down (this module only). */
const CN_UP = '#ff3b30';
const CN_DOWN = '#00b050';
const CN_NEUTRAL = '#737373';
const CN_UP_BAR = 'rgba(255,59,48,0.72)';
const CN_DOWN_BAR = 'rgba(0,176,80,0.72)';

function cnSignedColor(signed: number): string {
  if (signed > 0) return CN_UP;
  if (signed < 0) return CN_DOWN;
  return CN_NEUTRAL;
}

type WatchRow = {
  label: string;
  sinaKey: string;
  /** mock % if live fetch fails */
  mockPct: number;
};

const WATCHLIST: WatchRow[] = [
  { label: '0700.HK', sinaKey: 'hk00700', mockPct: 0.35 },
  { label: '9988.HK', sinaKey: 'hk09988', mockPct: -0.52 },
  { label: '600519.SS', sinaKey: 'sh600519', mockPct: 0.18 },
  { label: '002594.SZ', sinaKey: 'sz002594', mockPct: -0.21 },
];

/** Fallback labels when Sina name is empty or encoding is garbled in web preview. */
const WATCH_NAME_HINT: Record<string, string> = {
  hk00700: 'Tencent',
  hk09988: 'Alibaba',
  sh600519: 'Kweichow Moutai',
  sz002594: 'BYD',
};

type L2Row = { price: number; vol: string; side: 'bid' | 'ask' };

function buildL2Mock(): { bids: L2Row[]; asks: L2Row[] } {
  const mid = 388.0;
  const bids: L2Row[] = [];
  const asks: L2Row[] = [];
  for (let i = 0; i < 8; i++) {
    bids.push({ price: mid - 0.02 * (i + 1), vol: `${(1.2 + i * 0.35).toFixed(2)}万`, side: 'bid' });
    asks.push({ price: mid + 0.02 * (i + 1), vol: `${(0.9 + i * 0.28).toFixed(2)}万`, side: 'ask' });
  }
  return { bids, asks };
}

function SparkStrip({ points }: { points: number[] }) {
  const max = Math.max(...points, 1e-6);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  return (
    <View className="mt-1 h-6 flex-row items-end gap-px">
      {points.map((p, i) => {
        const next = points[i + 1];
        const prev = i > 0 ? points[i - 1]! : p;
        const up = next === undefined ? p >= prev : next > p;
        const h = 4 + ((p - min) / span) * 16;
        return (
          <View
            key={`${i}-${p}`}
            style={{
              height: Math.max(4, h),
              width: 3,
              borderRadius: 1,
              backgroundColor: up ? CN_UP_BAR : CN_DOWN_BAR,
            }}
          />
        );
      })}
    </View>
  );
}

export function ChineseMarketDashboard() {
  const formatBaseUsdAsCny = useWalletStore((s) => s.formatBaseUsdAsCny);
  const [quotes, setQuotes] = useState<Record<string, SinaParsedQuote>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const l2 = useMemo(() => buildL2Mock(), []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const map = await fetchSinaQuotes({ list: WATCHLIST.map((w) => w.sinaKey) });
      setQuotes(map);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Live quote fetch failed');
      setQuotes({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ScrollView className="flex-1 bg-[#0b0c10]" showsVerticalScrollIndicator={false}>
      <View className="border-b border-[#1e2230] px-3 py-3">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Buying power</Text>
            <Text className="mt-1 text-3xl font-semibold tracking-tight text-white">{formatBaseUsdAsCny()}</Text>
            <Text className="mt-1 text-[11px] text-neutral-500">Virtual · USD notional shown as CN¥</Text>
          </View>
          <Pressable
            onPress={() => void refresh()}
            className="rounded-lg border border-[#2a3042] bg-[#141824] px-3 py-2 active:opacity-80">
            <Text className="text-xs font-bold text-neutral-300">{loading ? '…' : 'Refresh'}</Text>
          </Pressable>
        </View>
        {loading ? <ActivityIndicator className="mt-3" color="#888" /> : null}
        {err ? (
          <Text className="mt-2 text-[11px] text-amber-500/90">
            {err} — showing mock % & static L2 (use device build or HTTPS proxy for Sina).
          </Text>
        ) : null}
      </View>

      <View className="px-2 py-2">
        <Text className="px-1 pb-2 text-xs font-black uppercase tracking-wide text-neutral-400">
          Watchlist · CN color (红涨绿跌)
        </Text>
        <View className="rounded-lg border border-[#1e2230] bg-[#0f1118]">
          <View className="flex-row border-b border-[#1e2230] bg-[#121520] px-2 py-1.5">
            <Text className="w-[22%] text-[10px] font-bold text-neutral-500">Code</Text>
            <Text className="w-[28%] text-[10px] font-bold text-neutral-500">Name</Text>
            <Text className="w-[22%] text-right text-[10px] font-bold text-neutral-500">Last</Text>
            <Text className="w-[28%] text-right text-[10px] font-bold text-neutral-500">Chg%</Text>
          </View>
          {WATCHLIST.map((w) => {
            const q = quotes[w.sinaKey];
            const pct = q ? changePctFromSina(q) : w.mockPct;
            const last = q?.last ?? (w.sinaKey.includes('hk') ? 380 + w.mockPct : 1600 + w.mockPct * 10);
            const rawName = q?.name?.trim();
            const name =
              rawName && rawName !== '' && rawName !== '—' ? rawName.slice(0, 8) : WATCH_NAME_HINT[w.sinaKey] ?? '—';
            const spark = [last * 0.998, last * 1.001, last * 0.997, last * 1.002, last * 0.999, last];
            return (
              <View key={w.sinaKey} className="border-b border-[#1a1d28] px-2 py-2.5">
                <View className="flex-row items-center">
                  <Text className="w-[22%] text-xs font-black text-white">{w.label}</Text>
                  <Text className="w-[28%] text-[11px] text-neutral-500" numberOfLines={1}>
                    {name}
                  </Text>
                  <Text className="w-[22%] text-right text-xs font-bold tabular-nums text-white">
                    {last.toFixed(2)}
                  </Text>
                  <Text
                    style={{ color: cnSignedColor(pct) }}
                    className="w-[28%] text-right text-xs font-black tabular-nums">
                    {pct >= 0 ? '+' : ''}
                    {pct.toFixed(2)}%
                  </Text>
                </View>
                <SparkStrip points={spark} />
              </View>
            );
          })}
        </View>
      </View>

      <View className="px-2 py-3">
        <Text className="px-1 pb-2 text-xs font-black uppercase tracking-wide text-neutral-400">
          Level 2 · depth (mock)
        </Text>
        <View className="flex-row rounded-lg border border-[#1e2230] bg-[#0f1118]">
          <View className="flex-1 border-r border-[#1e2230] px-1 py-2">
            <Text className="py-1 text-center text-[10px] font-bold text-[#ff3b30]">Bid</Text>
            {l2.bids.map((r, i) => (
              <View key={`b-${i}`} className="flex-row items-center justify-between py-0.5">
                <Text style={{ color: CN_UP }} className="w-[42%] text-right text-[10px] font-mono font-bold">
                  {r.price.toFixed(2)}
                </Text>
                <Text className="flex-1 text-right text-[10px] font-mono text-neutral-500">{r.vol}</Text>
              </View>
            ))}
          </View>
          <View className="flex-1 px-1 py-2">
            <Text className="py-1 text-center text-[10px] font-bold text-[#00b050]">Ask</Text>
            {l2.asks.map((r, i) => (
              <View key={`a-${i}`} className="flex-row items-center justify-between py-0.5">
                <Text style={{ color: CN_DOWN }} className="w-[42%] text-right text-[10px] font-mono font-bold">
                  {r.price.toFixed(2)}
                </Text>
                <Text className="flex-1 text-right text-[10px] font-mono text-neutral-500">{r.vol}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View className="px-2 pb-10">
        <Text className="px-1 pb-2 text-xs font-black uppercase tracking-wide text-neutral-400">
          PnL (virtual) · 红涨绿跌
        </Text>
        <View className="rounded-lg border border-[#1e2230] bg-[#0f1118] px-3 py-3">
          {[
            { n: 'Combined book', v: 12840 },
            { n: 'Day PnL', v: -420 },
            { n: 'Open PnL', v: 880 },
          ].map((row) => (
              <View key={row.n} className="mb-2 flex-row items-center justify-between last:mb-0">
                <Text className="text-xs text-neutral-400">{row.n}</Text>
                <Text
                  style={{ color: cnSignedColor(row.v) }}
                  className="text-sm font-black tabular-nums">
                  {row.v > 0 ? '+' : ''}
                  {row.v.toLocaleString('zh-CN')}
                </Text>
              </View>
            ))}
        </View>
      </View>

      <View className="px-2 pb-10 pt-2">
        <NativeAdSlot />
      </View>
    </ScrollView>
  );
}
