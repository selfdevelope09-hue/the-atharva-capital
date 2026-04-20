import FontAwesome from '@expo/vector-icons/FontAwesome';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { IndiaOptionChain } from '@/components/IndiaOptionChain';
import { NativeAdSlot } from '@/components/NativeAdCard';
import { enrichOptionChainGreeksAsync } from '@/lib/options/greeksAsync';
import { buildMockNseOptionChain, fetchNseOptionChainFromAngel } from '@/services/api/angelOptionChain';
import { useThemeStore } from '@/store/themeStore';
import { useWalletStore } from '@/store/walletStore';

type WorkspaceTab = 'overview' | 'options' | 'positions';

const TAB_LABEL: Record<WorkspaceTab, string> = {
  overview: 'Overview',
  options: 'Option chain',
  positions: 'Positions',
};

type Mover = { symbol: string; ltp: number; chg: number };

const GAINERS: Mover[] = [
  { symbol: 'TATAMOTORS', ltp: 988.4, chg: 3.42 },
  { symbol: 'ADANIPORTS', ltp: 1421.55, chg: 2.91 },
  { symbol: 'AXISBANK', ltp: 1124.1, chg: 2.05 },
  { symbol: 'ICICIBANK', ltp: 1262.3, chg: 1.88 },
];

const LOSERS: Mover[] = [
  { symbol: 'TECHM', ltp: 1488.2, chg: -2.14 },
  { symbol: 'HINDUNILVR', ltp: 2387.0, chg: -1.76 },
  { symbol: 'INFY', ltp: 1506.45, chg: -1.22 },
  { symbol: 'WIPRO', ltp: 248.6, chg: -0.98 },
];

const NIFTY_SPOT = 22_488;

const MOCK_POSITIONS = [
  { symbol: 'RELIANCE', qty: 10, avg: 2846.2, ltp: 2894.2, pnl: 480 },
  { symbol: 'HDFCBANK', qty: 25, avg: 1685.4, ltp: 1642.75, pnl: -1066.25 },
  { symbol: 'NIFTY24APR22450CE', qty: 2, avg: 112.5, ltp: 98.2, pnl: -28.6 },
];

const TabButton = memo(function TabButton({
  active,
  label,
  tabKey,
  onPressTab,
  accentColor,
}: {
  active: boolean;
  label: string;
  tabKey: WorkspaceTab;
  onPressTab: (k: WorkspaceTab) => void;
  accentColor: string;
}) {
  const onPress = useCallback(() => onPressTab(tabKey), [onPressTab, tabKey]);
  return (
    <Pressable
      onPress={onPress}
      className={`mr-1.5 rounded-md px-2 py-1 ${active ? 'bg-neutral-950' : 'bg-transparent'}`}>
      <Text
        className={`text-[11px] font-extrabold uppercase tracking-wide ${
          active ? 'text-neutral-100' : 'text-neutral-500'
        }`}>
        {label}
      </Text>
      {active ? <View className="mt-1 h-0.5 w-full rounded-full" style={{ backgroundColor: accentColor }} /> : null}
    </Pressable>
  );
});

const MoverCell = memo(function MoverCell({ m, up }: { m: Mover; up: boolean }) {
  const color = up ? 'text-emerald-400' : 'text-red-400';
  const sign = m.chg >= 0 ? '+' : '';
  return (
    <View className="flex-row items-center justify-between border-b border-[#1A1A1A] py-1.5">
      <View className="min-w-0 flex-1 pr-1.5">
        <Text className="font-mono text-[11px] font-bold tabular-nums text-neutral-100">{m.symbol}</Text>
        <Text className="mt-0.5 font-sans text-[9px] text-neutral-500">NSE</Text>
      </View>
      <Text className="font-mono text-[11px] font-semibold tabular-nums text-neutral-200">
        {m.ltp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
      </Text>
      <Text className={`ml-2 w-[60px] text-right font-mono text-[11px] font-bold tabular-nums ${color}`}>
        {sign}
        {m.chg.toFixed(2)}%
      </Text>
    </View>
  );
});

export function MainTradingArea() {
  const [tab, setTab] = useState<WorkspaceTab>('overview');
  const formatInr = useWalletStore((s) => s.formatInr);
  const palette = useThemeStore((s) => s.palette);
  const [optionRows, setOptionRows] = useState(() => buildMockNseOptionChain(NIFTY_SPOT));

  const hydrateOptionChain = useCallback(async () => {
    const live = await fetchNseOptionChainFromAngel('NIFTY');
    if (live) {
      setOptionRows(live);
      return;
    }
    const base = buildMockNseOptionChain(NIFTY_SPOT);
    setOptionRows(base);
    const enriched = await enrichOptionChainGreeksAsync(NIFTY_SPOT, base);
    setOptionRows(enriched);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const live = await fetchNseOptionChainFromAngel('NIFTY');
      if (cancelled) return;
      if (live) {
        setOptionRows(live);
        return;
      }
      const base = buildMockNseOptionChain(NIFTY_SPOT);
      setOptionRows(base);
      const enriched = await enrichOptionChainGreeksAsync(NIFTY_SPOT, base);
      if (!cancelled) setOptionRows(enriched);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPnl = useMemo(
    () => MOCK_POSITIONS.reduce((acc, p) => acc + p.pnl, 0),
    []
  );
  const pnlColor = totalPnl >= 0 ? 'text-[#00b050]' : 'text-[#ff3b30]';
  const pnlSign = totalPnl >= 0 ? '+' : '';

  const onPressTab = useCallback((k: WorkspaceTab) => setTab(k), []);

  return (
    <View className="flex-1" style={{ backgroundColor: palette.bg }}>
      <View className="border-b px-1.5 py-1" style={{ borderBottomColor: palette.border, backgroundColor: palette.bg }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
          {(Object.keys(TAB_LABEL) as WorkspaceTab[]).map((k) => (
            <TabButton
              key={k}
              active={tab === k}
              label={TAB_LABEL[k]}
              tabKey={k}
              accentColor={palette.accent}
              onPressTab={onPressTab}
            />
          ))}
        </ScrollView>
      </View>

      {tab === 'overview' ? (
        <ScrollView className="flex-1 px-2 pt-2" showsVerticalScrollIndicator={false}>
          <View className="flex-row gap-2">
            <View
              className="min-h-[108px] flex-1 rounded-lg border p-2"
              style={{ borderColor: palette.border, backgroundColor: palette.surface2 }}>
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-extrabold text-neutral-200">NIFTY 50</Text>
                <FontAwesome name="line-chart" size={14} color="#737373" />
              </View>
              <Text className="mt-2 font-mono text-xl font-black tabular-nums text-neutral-100">22,487.55</Text>
              <Text className="mt-1 text-xs font-semibold text-[#00b050]">+0.42% · spot</Text>
              <View className="mt-3 h-14 justify-end overflow-hidden rounded-lg bg-neutral-900">
                <View className="h-9 w-full rounded-t-md bg-[#00b050]/20" />
              </View>
            </View>

            <View
              className="min-h-[108px] flex-1 rounded-lg border p-2"
              style={{ borderColor: palette.border, backgroundColor: palette.surface2 }}>
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-extrabold text-neutral-200">BANK NIFTY</Text>
                <FontAwesome name="line-chart" size={14} color="#737373" />
              </View>
              <Text className="mt-2 font-mono text-xl font-black tabular-nums text-neutral-100">48,126.30</Text>
              <Text className="mt-1 text-xs font-semibold text-[#ff3b30]">-0.18% · spot</Text>
              <View className="mt-3 h-14 justify-end overflow-hidden rounded-lg bg-neutral-900">
                <View className="h-9 w-full rounded-t-md bg-[#ff3b30]/20" />
              </View>
            </View>
          </View>

          <View className="mt-2 flex-row gap-2">
            <View className="flex-1 rounded-lg border p-2" style={{ borderColor: palette.border, backgroundColor: palette.surface2 }}>
              <Text className="text-[11px] font-extrabold uppercase tracking-wide text-[#00b050]">
                Top gainers
              </Text>
              <View className="mt-2">
                {GAINERS.map((m) => (
                  <MoverCell key={m.symbol} m={m} up />
                ))}
              </View>
            </View>
            <View className="flex-1 rounded-lg border p-2" style={{ borderColor: palette.border, backgroundColor: palette.surface2 }}>
              <Text className="text-[11px] font-extrabold uppercase tracking-wide text-[#ff3b30]">
                Top losers
              </Text>
              <View className="mt-2">
                {LOSERS.map((m) => (
                  <MoverCell key={m.symbol} m={m} up={false} />
                ))}
              </View>
            </View>
          </View>

          <View className="my-2 rounded-lg border p-2" style={{ borderColor: palette.border, backgroundColor: palette.surface2 }}>
            <Text className="text-xs font-extrabold text-neutral-200">Market breadth</Text>
            <View className="mt-3 flex-row items-center gap-3">
              <View className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-900">
                <View className="h-2 w-[62%] rounded-full bg-[#00b050]" />
              </View>
              <Text className="text-[11px] font-bold text-neutral-400">62 / 38</Text>
            </View>
            <Text className="mt-2 text-[11px] text-neutral-600">Advances vs declines (mock)</Text>
          </View>

          <View className="mt-4 px-1 pb-4">
            <NativeAdSlot />
          </View>
        </ScrollView>
      ) : null}

      {tab === 'options' ? (
        <View className="flex-1">
          <View className="border-b px-2 py-1" style={{ borderBottomColor: palette.border }}>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-extrabold text-neutral-200">NIFTY · NSE option chain</Text>
              <Pressable
                onPress={() => void hydrateOptionChain()}
                hitSlop={8}
                className="flex-row items-center gap-1.5 rounded border px-2 py-1 active:opacity-80"
                style={{ borderColor: palette.border, backgroundColor: palette.surface2 }}>
                <FontAwesome name="refresh" size={14} color="#a3a3a3" />
                <Text className="text-[10px] font-bold text-neutral-400">Refresh</Text>
              </Pressable>
            </View>
            <Text className="mt-1 text-[10px] text-neutral-500">
              Spot {NIFTY_SPOT.toLocaleString('en-IN')} · SmartAPI live data when JWT is wired
            </Text>
          </View>
          <IndiaOptionChain spotPrice={NIFTY_SPOT} rows={optionRows} palette={palette} />
          <View className="border-t px-2 py-1" style={{ borderTopColor: palette.border }}>
            <NativeAdSlot compact />
          </View>
        </View>
      ) : null}

      {tab === 'positions' ? (
        <ScrollView className="flex-1 px-2 pt-2" showsVerticalScrollIndicator={false}>
          <View
            className="flex-row items-center justify-between rounded-lg border p-2"
            style={{ borderColor: palette.border, backgroundColor: palette.surface2 }}>
            <View>
              <Text className="text-[10px] font-extrabold uppercase tracking-wide text-neutral-500">
                Total PnL (virtual)
              </Text>
              <Text className={`mt-1 text-xl font-black tabular-nums ${pnlColor}`}>
                {pnlSign}
                {formatInr(totalPnl)}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-[10px] font-extrabold uppercase tracking-wide text-neutral-500">
                Margin used
              </Text>
              <Text className="mt-1 text-sm font-bold tabular-nums text-neutral-200">{formatInr(182_340)}</Text>
            </View>
          </View>

          <View className="mt-2 rounded-lg border" style={{ borderColor: palette.border }}>
            <View className="flex-row border-b px-1.5 py-1" style={{ borderBottomColor: palette.border, backgroundColor: palette.surface2 }}>
              <Text className="w-[26%] text-[10px] font-extrabold uppercase tracking-wide text-neutral-500">
                Symbol
              </Text>
              <Text className="w-[12%] text-right text-[10px] font-extrabold uppercase tracking-wide text-neutral-500">
                Qty
              </Text>
              <Text className="w-[20%] text-right text-[10px] font-extrabold uppercase tracking-wide text-neutral-500">
                Avg
              </Text>
              <Text className="w-[20%] text-right text-[10px] font-extrabold uppercase tracking-wide text-neutral-500">
                LTP
              </Text>
              <Text className="w-[22%] text-right text-[10px] font-extrabold uppercase tracking-wide text-neutral-500">
                PnL
              </Text>
            </View>

            {MOCK_POSITIONS.map((p) => {
              const up = p.pnl >= 0;
              const c = up ? 'text-[#00b050]' : 'text-[#ff3b30]';
              const s = p.pnl >= 0 ? '+' : '';
              return (
                <View key={p.symbol} className="flex-row border-b border-[#1A1A1A] px-1.5 py-1.5">
                  <Text
                    className="w-[26%] font-mono text-[11px] font-bold tabular-nums text-neutral-100"
                    numberOfLines={1}>
                    {p.symbol}
                  </Text>
                  <Text className="w-[12%] text-right font-mono text-[11px] font-semibold tabular-nums text-neutral-200">
                    {p.qty}
                  </Text>
                  <Text className="w-[20%] text-right font-mono text-[11px] font-semibold tabular-nums text-neutral-300">
                    {p.avg.toFixed(2)}
                  </Text>
                  <Text className="w-[20%] text-right font-mono text-[11px] font-semibold tabular-nums text-neutral-200">
                    {p.ltp.toFixed(2)}
                  </Text>
                  <Text className={`w-[22%] text-right font-mono text-[11px] font-extrabold tabular-nums ${c}`}>
                    {s}
                    {p.pnl.toFixed(2)}
                  </Text>
                </View>
              );
            })}
          </View>

          <Text className="my-4 text-center text-[11px] text-neutral-600">
            Holdings are illustrative. Ledger sync arrives in the execution phase.
          </Text>

          <View className="pb-4">
            <NativeAdSlot />
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}
