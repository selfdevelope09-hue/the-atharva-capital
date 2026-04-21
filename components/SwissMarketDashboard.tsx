import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { NativeAdSlot } from '@/components/NativeAdCard';
import { UniversalChart, type UniversalChartBar } from '@/components/UniversalChart';
import { fetchYahooBatch, type YahooQuote } from '@/src/services/yahooFinance';
import { calcChangePct } from '@/src/services/MarketDataService';
import { useWalletStore } from '@/store/walletStore';

/** Swissquote-inspired: institutional navy, crisp white copy, sharp card borders — SIX */
const BG = '#0c1929';
const CARD = '#0f172a';
const BORDER = '#334155';
const MUTED = '#94a3b8';
const GOLD = '#b8923a';

type WatchRow = { symbol: string; name: string; mock: number; mockPct: number };

const WATCHLIST: WatchRow[] = [
  { symbol: 'NESN.SW', name: 'Nestlé', mock: 88.2, mockPct: 0.12 },
  { symbol: 'NOVN.SW', name: 'Novartis', mock: 98.4, mockPct: -0.21 },
  { symbol: 'ROG.SW', name: 'Roche', mock: 246.1, mockPct: 0.05 },
  { symbol: 'UBSG.SW', name: 'UBS Group', mock: 28.7, mockPct: 0.33 },
];

const CAL_ROWS: { time: string; event: string; cons: string }[] = [
  { time: '09:45', event: 'SECO unemployment rate', cons: '2.6%' },
  { time: '11:00', event: 'SNB quarterly bulletin', cons: '—' },
  { time: '14:30', event: 'US retail sales (adj.)', cons: '+0.4%' },
];

const WIRE_HEADLINES: { id: string; src: string; title: string; ago: string }[] = [
  { id: '1', src: 'Reuters', title: 'Global equities steady as focus shifts to policy path', ago: '12m' },
  { id: '2', src: 'Bloomberg', title: 'Swiss franc liquidity conditions described as orderly', ago: '28m' },
  { id: '3', src: 'FT', title: 'Large-cap healthcare names lead defensive rotation in Europe', ago: '1h' },
];

function buildDemoCandles(barCount: number, seed: number): UniversalChartBar[] {
  const out: UniversalChartBar[] = [];
  const day = 86400;
  let t = Math.floor(Date.now() / 1000) - barCount * day;
  let c = 92 + (seed % 7);
  for (let i = 0; i < barCount; i++) {
    const o = c;
    const d = (Math.sin(i / 6 + seed * 0.07) + ((i % 10) - 4.5) * 0.09) * 1.6;
    const h = Math.max(o, c) + Math.abs(d) * 0.3 + 0.4;
    const l = Math.min(o, c) - Math.abs(d) * 0.3 - 0.4;
    c = Math.max(0.5, o + d);
    out.push({ time: t, open: o, high: h, low: l, close: c });
    t += day;
  }
  return out;
}

function cardShell(children: ReactNode) {
  return (
    <View
      className="mb-5 p-5"
      style={{
        backgroundColor: CARD,
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 4,
      }}>
      {children}
    </View>
  );
}

type SwissMarketDashboardProps = {
  isWide: boolean;
};

export function SwissMarketDashboard({ isWide }: SwissMarketDashboardProps) {
  const formatBaseUsdAsChf = useWalletStore((s) => s.formatBaseUsdAsChf);
  const usdToChf = useWalletStore((s) => s.usdToChf);
  const [quotes, setQuotes] = useState<Record<string, YahooQuote>>({});
  const [loading, setLoading] = useState(false);
  const [symbol, setSymbol] = useState('NESN.SW');
  const chartData = useMemo(() => buildDemoCandles(96, 41), []);

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

  const balanceBlock = (
    <View className="mb-6 border-b pb-6" style={{ borderBottomColor: BORDER }}>
      <Text className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: MUTED }}>
        Total assets · CHF
      </Text>
      <Text className="mt-3 text-3xl font-semibold tracking-tight text-white">{formatBaseUsdAsChf()}</Text>
      <Text className="mt-2 text-xs" style={{ color: MUTED }}>
        Virtual custody · USD notional at {usdToChf.toFixed(2)} CHF/USD
      </Text>
    </View>
  );

  const portfolioCard = cardShell(
    <>
      <View className="mb-4 flex-row items-center justify-between border-b pb-3" style={{ borderBottomColor: BORDER }}>
        <View>
          <Text className="text-sm font-semibold uppercase tracking-wide text-white">Portfolio performance</Text>
          <Text className="mt-1 text-xs" style={{ color: MUTED }}>
            SIX Swiss Exchange · indicative
          </Text>
        </View>
        <View className="rounded px-2 py-1" style={{ borderWidth: 1, borderColor: GOLD }}>
          <Text className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: GOLD }}>
            Secure session
          </Text>
        </View>
      </View>
      <UniversalChart data={chartData} colorTheme="dark" market="SWITZERLAND" symbol={symbol} minHeight={isWide ? 280 : 240} />
    </>
  );

  const orderTicket = cardShell(
    <>
      <Text className="text-sm font-semibold uppercase tracking-wide text-white">Order ticket</Text>
      <Text className="mt-1 text-xs" style={{ color: MUTED }}>
        Demo · no execution
      </Text>
      <Text className="mb-1 mt-4 text-[10px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
        Symbol
      </Text>
      <TextInput
        value={symbol}
        onChangeText={setSymbol}
        placeholder="NESN.SW"
        placeholderTextColor="#64748b"
        className="border px-3 py-2.5 text-sm font-medium text-white"
        style={{ borderColor: BORDER, backgroundColor: '#0b1220', borderRadius: 2 }}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <View className="mt-4 flex-row gap-3">
        <View className="flex-1">
          <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
            Quantity
          </Text>
          <TextInput
            placeholder="10"
            placeholderTextColor="#64748b"
            className="border px-3 py-2.5 text-sm text-white"
            style={{ borderColor: BORDER, backgroundColor: '#0b1220', borderRadius: 2 }}
            keyboardType="numeric"
          />
        </View>
        <View className="flex-1">
          <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
            Limit (CHF)
          </Text>
          <TextInput
            placeholder="Market"
            placeholderTextColor="#64748b"
            className="border px-3 py-2.5 text-sm text-white"
            style={{ borderColor: BORDER, backgroundColor: '#0b1220', borderRadius: 2 }}
            keyboardType="decimal-pad"
          />
        </View>
      </View>
      <View className="mt-5 flex-row gap-3">
        <Pressable
          className="flex-1 items-center border py-3 active:opacity-80"
          style={{ borderColor: '#7f1d1d', backgroundColor: 'rgba(127,29,29,0.25)', borderRadius: 2 }}>
          <Text className="text-sm font-semibold text-red-200">Sell</Text>
        </Pressable>
        <Pressable
          className="flex-1 items-center border py-3 active:opacity-80"
          style={{ borderColor: '#14532d', backgroundColor: 'rgba(20,83,45,0.28)', borderRadius: 2 }}>
          <Text className="text-sm font-semibold text-green-200">Buy</Text>
        </Pressable>
      </View>
      {!isWide ? (
        <View className="mt-5 border-t pt-4" style={{ borderTopColor: BORDER }}>
          <Text className="mb-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
            Sponsored
          </Text>
          <NativeAdSlot variant="minimal" compact />
        </View>
      ) : null}
    </>
  );

  const economicCalendar = cardShell(
    <>
      <Text className="text-sm font-semibold uppercase tracking-wide text-white">Economic calendar</Text>
      <Text className="mt-1 text-xs" style={{ color: MUTED }}>
        Zurich · sample events
      </Text>
      <View className="mt-4">
        {CAL_ROWS.map((row, i) => (
          <View
            key={row.time + row.event}
            className="flex-row items-center py-3"
            style={{
              borderBottomWidth: i < CAL_ROWS.length - 1 ? 1 : 0,
              borderBottomColor: BORDER,
            }}>
            <Text className="w-14 text-xs font-semibold tabular-nums text-white">{row.time}</Text>
            <Text className="min-w-0 flex-1 px-2 text-xs text-slate-200" numberOfLines={2}>
              {row.event}
            </Text>
            <Text className="text-xs tabular-nums" style={{ color: MUTED }}>
              {row.cons}
            </Text>
          </View>
        ))}
      </View>
    </>
  );

  const globalWire = cardShell(
    <>
      <Text className="text-sm font-semibold uppercase tracking-wide text-white">Global wire</Text>
      <Text className="mt-1 text-xs" style={{ color: MUTED }}>
        Headlines · delayed
      </Text>
      <View className="mt-4">
        {WIRE_HEADLINES.map((h, idx) => (
          <View key={h.id}>
            <Pressable className="border-b py-3 active:opacity-80" style={{ borderBottomColor: BORDER }}>
              <Text className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: GOLD }}>
                {h.src} · {h.ago}
              </Text>
              <Text className="mt-1.5 text-sm leading-snug text-white">{h.title}</Text>
            </Pressable>
            {idx === 0 && isWide ? (
              <View
                className="my-3 border px-2 py-3"
                style={{ borderColor: BORDER, backgroundColor: '#0b1220', borderRadius: 2 }}>
                <Text className="mb-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                  In this stream
                </Text>
                <NativeAdSlot variant="minimal" />
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </>
  );

  const watchlistBlock = (
    <View>
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-sm font-semibold uppercase tracking-wide text-white">SIX watchlist</Text>
        <Pressable onPress={() => void refresh()} className="border px-3 py-2 active:opacity-70" style={{ borderColor: BORDER }}>
          <Text className="text-xs font-semibold text-slate-200">{loading ? '…' : 'Refresh'}</Text>
        </Pressable>
      </View>
      {loading ? <ActivityIndicator color={GOLD} style={{ marginBottom: 16 }} /> : null}
      {WATCHLIST.map((w) => {
        const q = quotes[w.symbol];
        const px = q?.price ?? w.mock;
        const pct = calcChangePct(q, w.mockPct);
        const up = pct >= 0;
        return (
          <View
            key={w.symbol}
            className="mb-3 flex-row items-center justify-between border p-4"
            style={{ borderColor: BORDER, backgroundColor: CARD, borderRadius: 2 }}>
            <View className="min-w-0 flex-1 pr-3">
              <Text className="text-sm font-semibold text-white">{w.symbol}</Text>
              <Text className="mt-1 text-xs" style={{ color: MUTED }} numberOfLines={2}>
                {w.name}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-sm font-semibold tabular-nums text-white">
                {px.toLocaleString('de-CH', { maximumFractionDigits: 2 })}
              </Text>
              <Text className={`mt-1 text-xs font-semibold tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                {up ? '+' : ''}
                {pct.toFixed(2)}%
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );

  const mainColumn = (
    <View style={{ minWidth: 0 }}>
      {balanceBlock}
      {portfolioCard}
      {orderTicket}
      {watchlistBlock}
    </View>
  );

  const sideColumn = (
    <View style={{ minWidth: 0 }}>
      {economicCalendar}
      {globalWire}
    </View>
  );

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: BG }}
      contentContainerStyle={{
        paddingBottom: 40,
        paddingHorizontal: isWide ? 28 : 18,
        paddingTop: 24,
      }}
      showsVerticalScrollIndicator={false}>
      {isWide ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 20 }}>
          <View style={{ flex: 1.65, minWidth: 0 }}>{mainColumn}</View>
          <View style={{ flex: 1, maxWidth: 400, minWidth: 260 }}>{sideColumn}</View>
        </View>
      ) : (
        <View>
          {mainColumn}
          {sideColumn}
        </View>
      )}
    </ScrollView>
  );
}
