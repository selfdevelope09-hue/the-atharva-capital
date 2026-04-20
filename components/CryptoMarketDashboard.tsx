import Slider from '@react-native-community/slider';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { CRYPTO_USDT_SYMBOLS } from '@/constants/cryptoMarkets';
import { FullScreenTerminal } from '@/components/FullScreenTerminal';
import { NativeAdSlot } from '@/components/NativeAdCard';
import { OrderPanel } from '@/components/OrderPanel';
import { UniversalChart, type ChartIndicatorToggles, type UniversalChartBar } from '@/components/UniversalChart';
import { useMarketStore } from '@/store/marketStore';
import type { ThemePalette } from '@/store/themeStore';
import { useThemeStore } from '@/store/themeStore';
import {
  CRYPTO_MAKER_FEE_RATE,
  CRYPTO_TAKER_FEE_RATE,
  useCryptoMarginStore,
} from '@/store/cryptoMarginStore';
import type { CryptoPaperPosition } from '@/store/cryptoPaperStore';
import { useCryptoPaperStore } from '@/store/cryptoPaperStore';
import { useWalletStore } from '@/store/walletStore';

const LiveQuoteRow = memo(function LiveQuoteRow({ sym }: { sym: string }) {
  const q = useMarketStore((s) => s.liveQuotes[sym]);
  const palette = useThemeStore((s) => s.palette);
  const up = q ? q.change24hPct >= 0 : false;
  const color = q ? (up ? 'text-emerald-400' : 'text-rose-400') : 'text-neutral-500';
  return (
    <View
      className="mb-1.5 flex-row items-center justify-between rounded-lg border px-2 py-1.5"
      style={{ borderColor: palette.border, backgroundColor: palette.surface2 }}>
      <Text className="font-mono text-[11px] font-bold tabular-nums" style={{ color: palette.text }}>
        {sym}
      </Text>
      {q ? (
        <View className="items-end">
          <Text className="font-mono text-xs font-semibold tabular-nums" style={{ color: palette.text }}>
            {q.ltp.toLocaleString('en-US', { maximumFractionDigits: q.ltp < 1 ? 4 : 2 })}
          </Text>
          <Text className={`font-mono text-[10px] font-bold tabular-nums ${color}`}>
            {q.change24hPct >= 0 ? '+' : ''}
            {q.change24hPct.toFixed(2)}%
          </Text>
        </View>
      ) : (
        <Text className="font-sans text-[10px]" style={{ color: palette.textMuted }}>
          …
        </Text>
      )}
    </View>
  );
});

function buildDemoCandles(barCount: number, seed: number): UniversalChartBar[] {
  const out: UniversalChartBar[] = [];
  const day = 86400;
  let t = Math.floor(Date.now() / 1000) - barCount * day;
  let c = 96_000 + (seed % 2000);
  for (let i = 0; i < barCount; i++) {
    const o = c;
    const d = (Math.sin(i / 5 + seed * 0.08) + ((i % 11) - 5) * 0.06) * 420;
    const h = Math.max(o, c) + Math.abs(d) * 0.15 + 80;
    const l = Math.min(o, c) - Math.abs(d) * 0.15 - 80;
    c = Math.max(1000, o + d);
    out.push({ time: t, open: o, high: h, low: l, close: c });
    t += day;
  }
  return out;
}

function fmtVol(q?: { quoteVolume24h?: number }): string {
  const v = q?.quoteVolume24h;
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(0);
}

const PaperRow = memo(function PaperRow({
  pos,
  mark,
  palette,
  onClose,
}: {
  pos: CryptoPaperPosition;
  mark: number;
  palette: ThemePalette;
  onClose: (id: string) => void;
}) {
  const e = pos.entryPrice;
  const move = pos.side === 'LONG' ? mark - e : e - mark;
  const uPnL = e > 0 && mark > 0 ? (move / e) * pos.totalSize : 0;
  const up = uPnL >= 0;
  return (
    <View
      className="mb-2 rounded-lg border-l-4 px-2 py-2"
      style={{
        borderColor: palette.border,
        backgroundColor: palette.surface2,
        borderLeftColor: pos.side === 'LONG' ? '#22c55e' : '#f87171',
      }}>
      <View className="flex-row items-center justify-between">
        <Text className="font-mono text-[11px] font-black text-white">
          {pos.symbol.replace('USDT', '')} · {pos.side} {pos.leverage}x
        </Text>
        <Text className={`font-mono text-[11px] font-bold tabular-nums ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
          {uPnL >= 0 ? '+' : ''}${uPnL.toFixed(2)}
        </Text>
      </View>
      <Text className="mt-1 font-mono text-[10px] tabular-nums" style={{ color: palette.textMuted }}>
        Entry {e.toFixed(2)} · Mark {mark.toFixed(2)} · Margin ${pos.margin.toFixed(2)}
      </Text>
      <Pressable
        onPress={() => onClose(pos.id)}
        className="mt-2 self-end rounded border px-2 py-1"
        style={{ borderColor: palette.border }}>
        <Text className="text-[10px] font-bold" style={{ color: palette.text }}>
          Close (taker)
        </Text>
      </Pressable>
    </View>
  );
});

/** Crypto venue: live Binance ticks, chart shell, paper wallet + positions, dense quote list. */
export function CryptoMarketDashboard() {
  const formatBaseUsd = useWalletStore((s) => s.formatBaseUsd);
  const btcLtp = useMarketStore((s) => s.liveQuotes['BTCUSDT']?.ltp);
  const liveQuotes = useMarketStore((s) => s.liveQuotes);
  const activeDataSource = useMarketStore((s) => s.activeDataSource);
  const palette = useThemeStore((s) => s.palette);
  const setChartTicker = useMarketStore((s) => s.setChartTicker);

  const symbol = useCryptoMarginStore((s) => s.symbol);
  const setSymbol = useCryptoMarginStore((s) => s.setSymbol);
  const leverage = useCryptoMarginStore((s) => s.leverage);
  const marginMode = useCryptoMarginStore((s) => s.marginMode);
  const positionQty = useCryptoMarginStore((s) => s.positionQty);
  const entryPrice = useCryptoMarginStore((s) => s.entryPrice);
  const takeProfitPrice = useCryptoMarginStore((s) => s.takeProfitPrice);
  const stopLossPrice = useCryptoMarginStore((s) => s.stopLossPrice);
  const feeScenario = useCryptoMarginStore((s) => s.feeScenario);
  const side = useCryptoMarginStore((s) => s.side);

  const setTakeProfitPrice = useCryptoMarginStore((s) => s.setTakeProfitPrice);
  const setStopLossPrice = useCryptoMarginStore((s) => s.setStopLossPrice);
  const setFeeScenario = useCryptoMarginStore((s) => s.setFeeScenario);
  const seedFromMarkPrice = useCryptoMarginStore((s) => s.seedFromMarkPrice);
  const getTradingFeeUsd = useCryptoMarginStore((s) => s.getTradingFeeUsd);
  const getNotionalUsd = useCryptoMarginStore((s) => s.getNotionalUsd);

  const paperUsdt = useCryptoPaperStore((s) => s.paperUsdt);
  const positions = useCryptoPaperStore((s) => s.positions);
  const closeById = useCryptoPaperStore((s) => s.closeById);

  const chartData = useMemo(() => buildDemoCandles(140, 7), []);
  const [orderOpen, setOrderOpen] = useState(false);
  const [indicators, setIndicators] = useState<ChartIndicatorToggles>({
    ma20: true,
    ma50: true,
    rsi: false,
  });

  const markSeeded = useRef(false);
  useEffect(() => {
    if (markSeeded.current || btcLtp == null || btcLtp <= 0) return;
    markSeeded.current = true;
    seedFromMarkPrice(btcLtp);
  }, [btcLtp, seedFromMarkPrice]);

  useEffect(() => {
    setChartTicker(symbol);
  }, [symbol, setChartTicker]);

  const live = liveQuotes[symbol];
  const mark = live?.ltp ?? entryPrice;

  const onSelectSymbol = useCallback(
    (sym: string) => {
      setSymbol(sym);
      const px = useMarketStore.getState().liveQuotes[sym]?.ltp;
      if (px != null && px > 0) seedFromMarkPrice(px);
    },
    [setSymbol, seedFromMarkPrice]
  );

  const onClosePaper = useCallback(
    (id: string) => {
      const pos = useCryptoPaperStore.getState().positions.find((p) => p.id === id);
      const sym = pos?.symbol ?? symbol;
      const px =
        useMarketStore.getState().liveQuotes[sym]?.ltp ?? pos?.entryPrice ?? entryPrice;
      closeById(id, px);
    },
    [closeById, symbol, entryPrice]
  );

  const feeUsd = getTradingFeeUsd();
  const notionalUsd = getNotionalUsd();

  const tpMin = side === 'long' ? entryPrice * 1.0005 : entryPrice * 0.94;
  const tpMax = side === 'long' ? entryPrice * 1.06 : entryPrice * 0.9995;
  const slMin = side === 'long' ? entryPrice * 0.92 : entryPrice * 1.0005;
  const slMax = side === 'long' ? entryPrice * 0.9995 : entryPrice * 1.08;

  const tpSliderValue = Math.min(tpMax, Math.max(tpMin, takeProfitPrice));
  const slSliderValue = Math.min(slMax, Math.max(slMin, stopLossPrice));

  const onTpSlider = useCallback(
    (v: number) => {
      setTakeProfitPrice(v);
    },
    [setTakeProfitPrice]
  );

  const onSlSlider = useCallback(
    (v: number) => {
      setStopLossPrice(v);
    },
    [setStopLossPrice]
  );

  const riskOverlay = useMemo(
    () => ({
      takeProfit: takeProfitPrice,
      stopLoss: stopLossPrice,
      entryPrice,
    }),
    [takeProfitPrice, stopLossPrice, entryPrice]
  );

  return (
    <ScrollView
      className="flex-1 px-3 pt-3"
      style={{ backgroundColor: palette.bg }}
      showsVerticalScrollIndicator={false}>
      <Text className="text-2xl font-black" style={{ color: palette.text }}>
        USDT-M · Paper
      </Text>
      <Text className="mt-1 text-sm" style={{ color: palette.textMuted }}>
        Binance 24h tickers · {activeDataSource} · global wallet (display){' '}
        {formatBaseUsd()}
      </Text>

      <View className="mt-3 flex-row gap-2">
        <View className="min-w-0 flex-1 rounded-lg border px-2 py-2" style={{ borderColor: palette.border, backgroundColor: palette.surface2 }}>
          <Text className="text-[10px] font-bold uppercase" style={{ color: palette.textMuted }}>
            Paper USDT
          </Text>
          <Text className="mt-0.5 font-mono text-lg font-black tabular-nums" style={{ color: palette.accent }}>
            ${paperUsdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
        <Pressable
          onPress={() => setOrderOpen(true)}
          className="justify-center rounded-lg border px-3 py-2 active:opacity-90"
          style={{ borderColor: `${palette.accent}88`, backgroundColor: `${palette.accent}18` }}>
          <Text className="text-center text-xs font-black" style={{ color: palette.accent }}>
            Order ticket
          </Text>
        </Pressable>
      </View>

      <Text className="mb-1 mt-3 text-[10px] font-bold uppercase" style={{ color: palette.textMuted }}>
        Pairs
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="max-h-11">
        <View className="flex-row flex-wrap gap-1.5 pb-1">
          {CRYPTO_USDT_SYMBOLS.map((s) => {
            const on = s === symbol;
            return (
              <Pressable
                key={s}
                onPress={() => onSelectSymbol(s)}
                className="rounded-md border px-2.5 py-1.5"
                style={{
                  borderColor: on ? palette.accent : palette.border,
                  backgroundColor: on ? `${palette.accent}22` : palette.surface2,
                }}>
                <Text className="font-mono text-[11px] font-bold tabular-nums" style={{ color: palette.text }}>
                  {s.replace('USDT', '')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View
        className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-2 py-2"
        style={{ borderColor: palette.border, backgroundColor: palette.bg }}>
        <Text className="font-mono text-sm font-black text-white">{symbol.replace('USDT', '')}/USDT</Text>
        <Text
          className={`font-mono text-base font-black tabular-nums ${(live?.change24hPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          ${mark.toLocaleString('en-US', { maximumFractionDigits: mark < 1 ? 4 : 2 })}
        </Text>
        <Text
          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums ${(live?.change24hPct ?? 0) >= 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
          {(live?.change24hPct ?? 0) >= 0 ? '+' : ''}
          {(live?.change24hPct ?? 0).toFixed(2)}%
        </Text>
        <Text className="font-mono text-[10px] tabular-nums" style={{ color: palette.textMuted }}>
          H{' '}
          <Text style={{ color: palette.text }}>{live?.high24 != null ? live.high24.toFixed(2) : '—'}</Text>
        </Text>
        <Text className="font-mono text-[10px] tabular-nums" style={{ color: palette.textMuted }}>
          L{' '}
          <Text style={{ color: palette.text }}>{live?.low24 != null ? live.low24.toFixed(2) : '—'}</Text>
        </Text>
        <Text className="font-mono text-[10px] tabular-nums" style={{ color: palette.textMuted }}>
          Vol {fmtVol(live)}
        </Text>
      </View>

      {positions.length > 0 ? (
        <View className="mt-3">
          <Text className="mb-1 text-[10px] font-bold uppercase" style={{ color: palette.textMuted }}>
            Open paper positions
          </Text>
          {positions.map((p) => (
            <PaperRow
              key={p.id}
              pos={p}
              mark={liveQuotes[p.symbol]?.ltp ?? p.entryPrice}
              palette={palette}
              onClose={onClosePaper}
            />
          ))}
        </View>
      ) : null}

      <View className="mt-3 overflow-hidden rounded-xl border" style={{ borderColor: palette.border, backgroundColor: palette.surface2 }}>
        <View className="border-b px-2 py-2" style={{ borderBottomColor: palette.border }}>
          <Text className="text-sm font-bold" style={{ color: palette.text }}>
            Chart · TP / SL
          </Text>
          <Text className="mt-0.5 text-[11px]" style={{ color: palette.textMuted }}>
            Web: drag lines · Native: sliders · {marginMode} · {leverage}x · qty {positionQty.toFixed(6)}
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-1.5">
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
                  className={`rounded-full border px-2.5 py-1 ${on ? 'border-cyan-400 bg-cyan-500/15' : 'border-neutral-700 bg-neutral-950'}`}>
                  <Text className={`text-[10px] font-bold ${on ? 'text-cyan-200' : 'text-neutral-500'}`}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <FullScreenTerminal
          symbol={symbol}
          activeMarket="CRYPTO"
          onSymbolChange={setSymbol}
          embedMinHeight={280}>
          {(slot) => (
            <UniversalChart
              data={chartData}
              colorTheme="dark"
              market="CRYPTO"
              symbol={symbol}
              minHeight={slot.minHeight}
              riskOverlay={riskOverlay}
              livePrice={liveQuotes[symbol]?.ltp ?? liveQuotes['BTCUSDT']?.ltp}
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
        <View className="gap-2 border-t px-2 py-2" style={{ borderTopColor: palette.border }}>
          <View>
            <View className="mb-1 flex-row items-center justify-between">
              <Text className="text-[10px] font-bold uppercase text-emerald-300">Take profit</Text>
              <Text className="font-mono text-xs font-semibold tabular-nums text-white">{takeProfitPrice.toFixed(2)}</Text>
            </View>
            <Slider
              style={{ width: '100%', height: 36 }}
              minimumValue={tpMin}
              maximumValue={tpMax}
              value={tpSliderValue}
              onValueChange={onTpSlider}
              minimumTrackTintColor="#34d399"
              maximumTrackTintColor="#334155"
              thumbTintColor="#6ee7b7"
            />
          </View>
          <View>
            <View className="mb-1 flex-row items-center justify-between">
              <Text className="text-[10px] font-bold uppercase text-rose-300">Stop loss</Text>
              <Text className="font-mono text-xs font-semibold tabular-nums text-white">{stopLossPrice.toFixed(2)}</Text>
            </View>
            <Slider
              style={{ width: '100%', height: 36 }}
              minimumValue={slMin}
              maximumValue={slMax}
              value={slSliderValue}
              onValueChange={onSlSlider}
              minimumTrackTintColor="#fb7185"
              maximumTrackTintColor="#334155"
              thumbTintColor="#fda4af"
            />
          </View>
        </View>
      </View>

      <View className="mt-2 rounded-xl border px-2 py-2" style={{ borderColor: palette.border, backgroundColor: palette.surface2 }}>
        <Text className="text-[10px] font-bold uppercase" style={{ color: palette.textMuted }}>
          Fees (chart preview)
        </Text>
        <View className="mt-2 flex-row gap-2">
          <Pressable
            onPress={() => setFeeScenario('maker')}
            className={`flex-1 rounded-lg border py-2 ${feeScenario === 'maker' ? 'border-cyan-500 bg-cyan-500/10' : 'border-neutral-800'}`}>
            <Text className="text-center font-mono text-[10px] font-bold text-cyan-200">
              Maker {(CRYPTO_MAKER_FEE_RATE * 100).toFixed(2)}%
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setFeeScenario('taker')}
            className={`flex-1 rounded-lg border py-2 ${feeScenario === 'taker' ? 'border-orange-500 bg-orange-500/10' : 'border-neutral-800'}`}>
            <Text className="text-center font-mono text-[10px] font-bold text-orange-200">
              Taker {(CRYPTO_TAKER_FEE_RATE * 100).toFixed(2)}%
            </Text>
          </Pressable>
        </View>
        <Text className="mt-2 text-[11px]" style={{ color: palette.textMuted }}>
          Notional{' '}
          <Text className="font-mono font-semibold text-white">${notionalUsd.toFixed(2)}</Text> · fee ≈{' '}
          <Text className="font-mono font-bold text-white">${feeUsd.toFixed(4)}</Text> ({feeScenario})
        </Text>
      </View>

      <Text className="mb-1 mt-4 text-[10px] font-bold uppercase" style={{ color: palette.textMuted }}>
        Live quotes
      </Text>
      {CRYPTO_USDT_SYMBOLS.map((sym) => (
        <LiveQuoteRow key={sym} sym={sym} />
      ))}

      <View className="mt-4 flex-row items-start gap-2 pb-8">
        <FontAwesome name="info-circle" size={14} color={palette.textMuted} style={{ marginTop: 2 }} />
        <Text className="flex-1 text-[10px] leading-4" style={{ color: palette.textMuted }}>
          Firestore sync (balance + positions + watchlist) belongs in a secure client layer using env-based config —
          never commit API keys. This build keeps paper state local (Zustand) for speed.
        </Text>
      </View>

      <View className="pb-4">
        <NativeAdSlot />
      </View>

      <OrderPanel mode="crypto" visible={orderOpen} onClose={() => setOrderOpen(false)} markPrice={mark} />
    </ScrollView>
  );
}
