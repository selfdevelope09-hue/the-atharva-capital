import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { FullScreenTerminal } from '@/components/FullScreenTerminal';
import { NativeAdSlot } from '@/components/NativeAdCard';
import { OrderPanel } from '@/components/OrderPanel';
import { UniversalChart, type ChartIndicatorToggles, type UniversalChartBar } from '@/components/UniversalChart';
import { useCryptoMarginStore } from '@/store/cryptoMarginStore';
import { useMarketStore } from '@/store/marketStore';
import { useWalletStore } from '@/store/walletStore';

type UsRow = { symbol: string; name: string; price: number; chg: number };

const WATCHLIST: UsRow[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 198.42, chg: 0.62 },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 248.3, chg: -1.24 },
  { symbol: 'MSFT', name: 'Microsoft', price: 415.12, chg: 0.31 },
  { symbol: 'NVDA', name: 'NVIDIA', price: 892.55, chg: 2.08 },
];

const TRENDING: UsRow[] = [
  { symbol: 'META', name: 'Meta Platforms', price: 502.18, chg: 1.05 },
  { symbol: 'AMD', name: 'Advanced Micro', price: 162.44, chg: 0.88 },
  { symbol: 'AMZN', name: 'Amazon', price: 178.92, chg: -0.42 },
  { symbol: 'GOOGL', name: 'Alphabet', price: 165.33, chg: 0.19 },
];

const PREMARKET: UsRow[] = [
  { symbol: 'PLTR', name: 'Palantir', price: 24.88, chg: 3.1 },
  { symbol: 'COIN', name: 'Coinbase', price: 221.4, chg: -2.4 },
  { symbol: 'SMCI', name: 'Super Micro', price: 812.1, chg: 1.7 },
  { symbol: 'MARA', name: 'Marathon Digital', price: 18.22, chg: -4.2 },
];

function buildUsDemoBars(barCount: number): UniversalChartBar[] {
  const out: UniversalChartBar[] = [];
  const day = 86_400;
  let t = Math.floor(Date.now() / 1000) - barCount * day;
  let c = 418 + (barCount % 17);
  for (let i = 0; i < barCount; i++) {
    const o = c;
    const d = (Math.sin(i / 6) + ((i % 9) - 4) * 0.05) * 6.2;
    const h = Math.max(o, c) + Math.abs(d) * 0.08 + 1.2;
    const l = Math.min(o, c) - Math.abs(d) * 0.08 - 1.2;
    c = Math.max(12, o + d);
    out.push({ time: t, open: o, high: h, low: l, close: c });
    t += day;
  }
  return out;
}

function StockCard({ row, onPress }: { row: UsRow; onPress: () => void }) {
  const up = row.chg >= 0;
  const color = up ? 'text-[#00C805]' : 'text-[#FF4F79]';
  const sign = up ? '+' : '';
  return (
    <Pressable
      onPress={onPress}
      className="mb-3 w-[48%] rounded-2xl border border-neutral-800/80 bg-[#141414] p-4 active:opacity-90">
      <Text className="text-lg font-black tracking-tight text-white">{row.symbol}</Text>
      <Text className="mt-1 text-xs text-neutral-500" numberOfLines={1}>
        {row.name}
      </Text>
      <Text className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-white">
        ${row.price.toFixed(2)}
      </Text>
      <Text className={`mt-1 text-sm font-semibold tabular-nums ${color}`}>
        {sign}
        {row.chg.toFixed(2)}%
      </Text>
    </Pressable>
  );
}

export function USMarketDashboard() {
  const formatBaseUsd = useWalletStore((s) => s.formatBaseUsd);
  const setChartTicker = useMarketStore((s) => s.setChartTicker);
  const [toast, setToast] = useState<string | null>(null);
  const [usTicker, setUsTicker] = useState('NVDA');
  const [orderOpen, setOrderOpen] = useState(false);
  const [indicators, setIndicators] = useState<ChartIndicatorToggles>({
    ma20: true,
    ma50: false,
    rsi: false,
  });

  const seedFromMarkPrice = useCryptoMarginStore((s) => s.seedFromMarkPrice);
  const takeProfitPrice = useCryptoMarginStore((s) => s.takeProfitPrice);
  const stopLossPrice = useCryptoMarginStore((s) => s.stopLossPrice);
  const entryPrice = useCryptoMarginStore((s) => s.entryPrice);
  const positionQty = useCryptoMarginStore((s) => s.positionQty);
  const side = useCryptoMarginStore((s) => s.side);
  const setTakeProfitPrice = useCryptoMarginStore((s) => s.setTakeProfitPrice);
  const setStopLossPrice = useCryptoMarginStore((s) => s.setStopLossPrice);

  const chartData = useMemo(() => buildUsDemoBars(160), []);

  useEffect(() => {
    seedFromMarkPrice(418.5);
  }, [seedFromMarkPrice]);

  useEffect(() => {
    setChartTicker(usTicker);
  }, [usTicker, setChartTicker]);

  const riskOverlay = useMemo(
    () => ({
      takeProfit: takeProfitPrice,
      stopLoss: stopLossPrice,
      entryPrice,
    }),
    [takeProfitPrice, stopLossPrice, entryPrice]
  );

  function tap(sym: string) {
    setToast(`${sym} · paper trade soon`);
    setTimeout(() => setToast(null), 1600);
  }

  return (
    <View className="flex-1 bg-[#0c0c0e]">
      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        <View className="rounded-3xl border border-neutral-800 bg-[#111] p-5">
          <Text className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">Buying power</Text>
          <Text className="mt-2 text-4xl font-semibold tracking-tight text-white">{formatBaseUsd()}</Text>
          <Text className="mt-2 text-sm text-neutral-500">Virtual USD · same notional as other markets</Text>
        </View>

        <Pressable
          onPress={() => setOrderOpen(true)}
          className="mt-6 rounded-2xl border border-emerald-700/40 bg-emerald-950/30 px-4 py-3 active:opacity-90">
          <Text className="text-center text-sm font-black text-emerald-200">Open US order ticket</Text>
          <Text className="mt-1 text-center text-[10px] text-neutral-500">
            Shared margin model · max 20x in US mode · sheet UI
          </Text>
        </Pressable>

        <View className="mt-6 overflow-hidden rounded-2xl border border-neutral-800 bg-[#0d0d0f]">
          <View className="border-b border-neutral-800 px-4 py-3">
            <Text className="text-sm font-bold text-white">US session chart (sim)</Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {(
                [
                  ['ma20', 'MA 20'],
                  ['ma50', 'MA 50'],
                  ['rsi', 'RSI 14'],
                ] as const
              ).map(([k, label]) => {
                const on = indicators[k];
                return (
                  <Pressable
                    key={k}
                    onPress={() => setIndicators((prev) => ({ ...prev, [k]: !prev[k] }))}
                    className={`rounded-full border px-3 py-1 ${on ? 'border-emerald-500/70 bg-emerald-500/10' : 'border-neutral-700 bg-neutral-900'}`}>
                    <Text className={`text-[11px] font-bold ${on ? 'text-emerald-200' : 'text-neutral-500'}`}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <FullScreenTerminal
            symbol={usTicker}
            activeMarket="US"
            onSymbolChange={setUsTicker}
            embedMinHeight={260}>
            {(slot) => (
              <UniversalChart
                data={chartData}
                colorTheme="dark"
                market="US"
                symbol={usTicker}
                minHeight={slot.minHeight}
                seriesPresentation="softArea"
                riskOverlay={riskOverlay}
                quoteCurrency="USD"
                positionQty={positionQty}
                positionSide={side === 'long' ? 'long' : 'short'}
                onRiskChange={(p) => {
                  if (p.takeProfit != null) setTakeProfitPrice(p.takeProfit);
                  if (p.stopLoss != null) setStopLossPrice(p.stopLoss);
                }}
                indicators={indicators}
                showFullscreenButton={slot.showFullscreenButton}
                onFullscreenPress={slot.onFullscreenPress}
              />
            )}
          </FullScreenTerminal>
        </View>

        <Text className="mb-3 mt-8 text-xl font-bold text-white">Watchlist</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1 pb-1">
          <View className="flex-row gap-3 px-1">
            {WATCHLIST.map((row) => (
              <Pressable
                key={row.symbol}
                onPress={() => tap(row.symbol)}
                className="w-[132px] rounded-2xl border border-neutral-800 bg-[#141414] p-3 active:opacity-90">
                <Text className="text-base font-bold text-white">{row.symbol}</Text>
                <Text className="mt-2 text-lg font-semibold tabular-nums text-white">${row.price.toFixed(2)}</Text>
                <Text
                  className={`mt-1 text-xs font-semibold tabular-nums ${
                    row.chg >= 0 ? 'text-[#00C805]' : 'text-[#FF4F79]'
                  }`}>
                  {row.chg >= 0 ? '+' : ''}
                  {row.chg.toFixed(2)}%
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <Text className="mb-3 mt-10 text-xl font-bold text-white">Trending stocks</Text>
        <View className="flex-row flex-wrap justify-between">
          {TRENDING.map((row) => (
            <StockCard key={row.symbol} row={row} onPress={() => tap(row.symbol)} />
          ))}
        </View>

        <Text className="mb-3 mt-8 text-xl font-bold text-white">Pre-market movers</Text>
        <View className="flex-row flex-wrap justify-between">
          {PREMARKET.map((row) => (
            <StockCard key={row.symbol} row={row} onPress={() => tap(row.symbol)} />
          ))}
        </View>

        <View className="mt-6 pb-10">
          <NativeAdSlot />
        </View>
      </ScrollView>

      {toast ? (
        <View className="absolute bottom-6 self-center rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2">
          <Text className="text-xs font-semibold text-white">{toast}</Text>
        </View>
      ) : null}

      <OrderPanel mode="us" visible={orderOpen} onClose={() => setOrderOpen(false)} />
    </View>
  );
}
