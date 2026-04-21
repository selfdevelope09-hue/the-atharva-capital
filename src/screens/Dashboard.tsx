/**
 * Phase 4 — Portfolio dashboard: stats, equity curve, positions, history, heatmap, streak.
 */

import type { AppMarket } from '@/constants/appMarkets';
import { BannerAd } from '@/src/components/ads/BannerAd';
import { useRouter, type Href } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Defs, Line, LinearGradient, Polygon, Polyline, Stop, Text as SvgText } from 'react-native-svg';

import { MARKETS, type MarketId } from '@/src/constants/markets';
import { fmtCompact, fmtMoney, fmtPct, T } from '@/src/constants/theme';
import { useUnifiedMarketsPrices } from '@/src/contexts/MarketPriceContext';
import { MarketSelector, type MarketSelectorValue } from '@/src/components/shared/MarketSelector';
import { PositionChartModal } from '@/src/components/shared/PositionChartModal';
import {
  computeLiquidationPrice,
  useLedgerStore,
} from '@/store/ledgerStore';
import { useMultiMarketBalanceStore } from '@/store/multiMarketBalanceStore';
import { useProfileStore } from '@/store/profileStore';
import type { LedgerClosedTrade, LedgerOpenPosition } from '@/types/ledger';
import {
  buildEquitySeries,
  dailyPnlMap,
  filterByRange,
  fmtHold,
  maxDrawdown,
  tradePnlUsd,
  unrealizedPnlUsd,
  type CurveRange,
  winStreak,
} from '@/src/screens/dashboardMath';
import { useBreakpoint } from '@/hooks/useBreakpoint';

const W = Dimensions.get('window').width - 32;

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: '30%',
        minWidth: 100,
        backgroundColor: T.bg1,
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: T.radiusMd,
        padding: 10,
        gap: 4,
      }}
    >
      <Text style={{ color: T.text3, fontSize: 10, fontWeight: '700' }}>{label}</Text>
      <Text style={{ color: T.text0, fontSize: 14, fontWeight: '800' }} numberOfLines={2}>
        {value}
      </Text>
      {sub ? <Text style={{ color: T.text3, fontSize: 10 }}>{sub}</Text> : null}
    </View>
  );
}

function EquityChart({
  pts,
  dd,
  width,
  height,
}: {
  pts: { ts: number; v: number }[];
  dd: number;
  width: number;
  height: number;
}) {
  if (pts.length < 2) {
    return (
      <Text style={{ color: T.text3, fontSize: 12, padding: 16 }}>Close trades to build your equity curve.</Text>
    );
  }
  const vals = pts.map((p) => p.v);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const pad = Math.max(1e-9, maxV - minV) * 0.08;
  const ymin = minV - pad;
  const ymax = maxV + pad;
  const mapX = (i: number) => (i / (pts.length - 1)) * (width - 8) + 4;
  const mapY = (v: number) => 4 + (height - 8) * (1 - (v - ymin) / (ymax - ymin));
  const linePts = pts.map((p, i) => `${mapX(i)},${mapY(p.v)}`).join(' ');
  const peakLine = Math.max(...vals);
  const peakY = mapY(peakLine);
  const polyShade = `${mapX(0)},${height} ${pts.map((p, i) => `${mapX(i)},${mapY(p.v)}`).join(' ')} ${mapX(pts.length - 1)},${height}`;

  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="dd" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={T.red} stopOpacity={0.35} />
            <Stop offset="1" stopColor={T.red} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>
        <Polygon points={polyShade} fill={T.greenDim} opacity={0.35} />
        <Line x1={4} x2={width - 4} y1={peakY} y2={peakY} stroke={T.text3} strokeDasharray="4 6" strokeWidth={1} />
        <Polyline points={linePts} fill="none" stroke={T.green} strokeWidth={2} />
        <SvgText x={8} y={16} fill={T.text2} fontSize={10}>{`Max DD ≈ ${fmtMoney(dd, '$')}`}</SvgText>
      </Svg>
    </View>
  );
}

function Heatmap({ daily, width }: { daily: Map<string, number>; width: number }) {
  const days = 49;
  const now = new Date();
  const cells: { key: string; c: string; pnl: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const pnl = daily.get(key) ?? 0;
    const c = pnl > 0 ? T.greenDim : pnl < 0 ? T.redDim : T.bg2;
    cells.push({ key, c, pnl });
  }
  const cell = Math.floor((width - 24) / 7) - 2;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, maxWidth: width }}>
      {cells.map((x) => (
        <View
          key={x.key}
          style={{
            width: cell,
            height: cell,
            borderRadius: 4,
            backgroundColor: x.c,
            borderWidth: 1,
            borderColor: T.border,
          }}
        />
      ))}
    </View>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [marketSel, setMarketSel] = useState<MarketSelectorValue>('all');
  const [curveRange, setCurveRange] = useState<CurveRange>('1M');
  const [chartPos, setChartPos] = useState<LedgerOpenPosition | null>(null);
  const [editPos, setEditPos] = useState<LedgerOpenPosition | null>(null);
  const [tpStr, setTpStr] = useState('');
  const [slStr, setSlStr] = useState('');

  const [histMarket, setHistMarket] = useState<MarketSelectorValue>('all');
  const [histWin, setHistWin] = useState<'all' | 'win' | 'loss'>('all');
  const [histSym, setHistSym] = useState('');
  const [histFrom, setHistFrom] = useState('');
  const [histTo, setHistTo] = useState('');

  const openPositions = useLedgerStore((s) => s.openPositions);
  const closedTrades = useLedgerStore((s) => s.closedTrades);
  const closePosition = useLedgerStore((s) => s.closePosition);
  const updateTpSl = useLedgerStore((s) => s.updateTpSl);
  const appendEquity = useLedgerStore((s) => s.appendEquitySnapshot);

  const rates = useMultiMarketBalanceStore((s) => s.usdRates);
  const refreshFx = useMultiMarketBalanceStore((s) => s.refreshFx);
  const balances = useMultiMarketBalanceStore((s) => s.balances);
  const portfolioUsd = useMemo(
    () => useMultiMarketBalanceStore.getState().totalPortfolioUsd(),
    [balances, rates]
  );

  const { ticks, subscribeMarket, unsubscribeMarket } = useUnifiedMarketsPrices();

  const clientId = useProfileStore((s) => s.clientId);
  const { isNavRail } = useBreakpoint();

  useEffect(() => {
    void refreshFx();
  }, [refreshFx]);

  const marketsNeeded = useMemo(() => {
    const s = new Set<MarketId>();
    openPositions.forEach((p) => s.add(p.market as MarketId));
    return [...s];
  }, [openPositions]);

  useEffect(() => {
    marketsNeeded.forEach((m) => subscribeMarket(m));
    return () => marketsNeeded.forEach((m) => unsubscribeMarket(m));
  }, [marketsNeeded, subscribeMarket, unsubscribeMarket]);

  const filteredOpen = useMemo(() => {
    if (marketSel === 'all') return openPositions;
    return openPositions.filter((p) => p.market === marketSel);
  }, [openPositions, marketSel]);

  const filteredClosed = useMemo(() => {
    let rows = closedTrades;
    if (marketSel !== 'all') rows = rows.filter((t) => t.market === marketSel);
    rows = filterByRange(rows, curveRange);
    return rows;
  }, [closedTrades, marketSel, curveRange]);

  const statsClosed = useMemo(() => {
    let rows = closedTrades;
    if (marketSel !== 'all') rows = rows.filter((t) => t.market === marketSel);
    return filterByRange(rows, curveRange);
  }, [closedTrades, marketSel, curveRange]);

  const unrealizedTotalUsd = useMemo(() => {
    let u = 0;
    for (const p of filteredOpen) {
      const mark = ticks[p.symbolFull]?.price ?? p.entryPrice;
      u += unrealizedPnlUsd(p, mark, rates);
    }
    return u;
  }, [filteredOpen, ticks, rates]);

  const realizedUsd = useMemo(() => statsClosed.reduce((a, t) => a + tradePnlUsd(t, rates), 0), [statsClosed, rates]);

  const winRate = useMemo(() => {
    if (statsClosed.length === 0) return 0;
    return statsClosed.filter((t) => t.win).length / statsClosed.length;
  }, [statsClosed]);

  const totalFees = useMemo(
    () => statsClosed.reduce((a, t) => a + t.feeOpen + t.feeClose, 0),
    [statsClosed]
  );

  const avgHoldMin = useMemo(() => {
    if (statsClosed.length === 0) return 0;
    return statsClosed.reduce((a, t) => a + t.holdMinutes, 0) / statsClosed.length;
  }, [statsClosed]);

  const bestTrade = useMemo(() => {
    if (statsClosed.length === 0) return null;
    return statsClosed.reduce((a, t) => (tradePnlUsd(t, rates) > tradePnlUsd(a, rates) ? t : a), statsClosed[0]);
  }, [statsClosed, rates]);

  const worstTrade = useMemo(() => {
    if (statsClosed.length === 0) return null;
    return statsClosed.reduce((a, t) => (tradePnlUsd(t, rates) < tradePnlUsd(a, rates) ? t : a), statsClosed[0]);
  }, [statsClosed, rates]);

  const streak = useMemo(() => winStreak(statsClosed), [statsClosed]);

  const equityPts = useMemo(
    () => buildEquitySeries(statsClosed, rates, curveRange),
    [statsClosed, rates, curveRange]
  );
  const ddVal = useMemo(() => maxDrawdown(equityPts), [equityPts]);

  const dailyMap = useMemo(() => dailyPnlMap(statsClosed), [statsClosed]);

  const lastEqRef = useRef(0);
  useEffect(() => {
    const port = portfolioUsd + unrealizedTotalUsd;
    const now = Date.now();
    if (now - lastEqRef.current < 45000) return;
    lastEqRef.current = now;
    appendEquity(port);
  }, [portfolioUsd, unrealizedTotalUsd, appendEquity]);

  const onSelChange = (v: MarketSelectorValue) => {
    setMarketSel(v);
  };

  const historyRows = useMemo(() => {
    let rows = closedTrades;
    if (histMarket !== 'all') rows = rows.filter((t) => t.market === histMarket);
    if (histWin === 'win') rows = rows.filter((t) => t.win);
    if (histWin === 'loss') rows = rows.filter((t) => !t.win);
    if (histSym.trim()) {
      const q = histSym.trim().toUpperCase();
      rows = rows.filter((t) => t.symbol.toUpperCase().includes(q));
    }
    if (histFrom) rows = rows.filter((t) => t.closedAt >= histFrom);
    if (histTo) rows = rows.filter((t) => t.closedAt.slice(0, 10) <= histTo);
    return rows;
  }, [closedTrades, histMarket, histWin, histSym, histFrom, histTo]);

  const exportCsv = async () => {
    const header = 'closedAt,symbol,market,side,entry,exit,realizedPnL,feeOpen,feeClose,win';
    const lines = historyRows.map(
      (t) =>
        `${t.closedAt},${t.symbol},${t.market},${t.side},${t.entryPrice},${t.exitPrice},${t.realizedPnl},${t.feeOpen},${t.feeClose},${t.win}`
    );
    const csv = [header, ...lines].join('\n');
    await Share.share({ message: csv, title: 'Trade history CSV' });
  };

  const balanceDisplay =
    marketSel === 'all'
      ? fmtMoney(portfolioUsd, '$')
      : fmtMoney(balances[marketSel as AppMarket] ?? 0, MARKETS[marketSel as MarketId].currencySymbol);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: T.bg0,
        flexDirection: isNavRail && Platform.OS === 'web' ? 'row' : 'column',
      }}
    >
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 8 }}>
          <Text style={{ color: T.text0, fontSize: 18, fontWeight: '800' }}>Dashboard</Text>
          <Pressable onPress={() => router.push('/(tabs)/alerts' as Href)} style={{ padding: 8 }}>
            <Text style={{ fontSize: 20 }}>🔔</Text>
          </Pressable>
        </View>
        <MarketSelector active={marketSel} onChange={onSelChange} />

        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <BannerAd slot="top" />
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
          <Text style={{ color: T.text2, fontSize: 12 }}>
            Client {clientId ?? '—'} · {marketSel === 'all' ? 'All markets' : MARKETS[marketSel as MarketId].name}
          </Text>
          {streak >= 3 ? (
            <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: T.greenDim }}>
              <Text style={{ color: T.green, fontWeight: '800' }}>{`🔥 ${streak} win streak!`}</Text>
            </View>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <StatCard label="Balance" value={balanceDisplay} sub={marketSel === 'all' ? 'Portfolio USD' : 'Local wallet'} />
          <StatCard label="Unrealized PnL" value={fmtMoney(unrealizedTotalUsd, '$')} />
          <StatCard label="Realized PnL" value={fmtMoney(realizedUsd, '$')} />
          <StatCard label="Win rate" value={fmtPct(winRate * 100, 1)} />
          <StatCard label="Open positions" value={String(filteredOpen.length)} />
          <StatCard label="Total trades" value={String(statsClosed.length)} />
          <StatCard
            label="Best trade"
            value={bestTrade ? fmtMoney(tradePnlUsd(bestTrade, rates), '$') : '—'}
            sub={bestTrade?.symbol}
          />
          <StatCard
            label="Worst trade"
            value={worstTrade ? fmtMoney(tradePnlUsd(worstTrade, rates), '$') : '—'}
            sub={worstTrade?.symbol}
          />
          <StatCard label="Avg hold" value={`${avgHoldMin.toFixed(0)} min`} />
          <StatCard label="Fees paid" value={fmtMoney(totalFees, '$')} sub="All-in per market ccy" />
        </View>


        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          <Text style={{ color: T.text0, fontWeight: '800', marginBottom: 8 }}>Equity curve</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 8 }}>
            {(['1D', '1W', '1M', '3M', 'ALL'] as CurveRange[]).map((r) => {
              const on = curveRange === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setCurveRange(r)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: on ? T.bg2 : T.bg1,
                    borderWidth: 1,
                    borderColor: on ? T.yellow : T.border,
                  }}
                >
                  <Text style={{ color: on ? T.text0 : T.text2, fontWeight: '700', fontSize: 12 }}>{r}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <EquityChart pts={equityPts} dd={ddVal} width={W} height={160} />
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          <Text style={{ color: T.text0, fontWeight: '800', marginBottom: 8 }}>Calendar (realized, local ccy)</Text>
          <Heatmap daily={dailyMap} width={W} />
        </View>


        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          <Text style={{ color: T.text0, fontWeight: '800', marginBottom: 8 }}>Open positions</Text>
          {filteredOpen.length === 0 ? (
            <Text style={{ color: T.text3, fontSize: 13 }}>No open positions for this filter.</Text>
          ) : (
            filteredOpen.flatMap((p, idx) => {
              const mark = ticks[p.symbolFull]?.price ?? p.entryPrice;
              const uPnL = unrealizedPnlUsd(p, mark, rates);
              const liq = computeLiquidationPrice(p);
              const opened = new Date(p.openedAt).getTime();
              const age = fmtHold(Date.now() - opened);
              const cfg = MARKETS[p.market as MarketId];
              const card = (
                <Pressable
                  key={p.id}
                  onPress={() => setChartPos(p)}
                  style={{
                    backgroundColor: T.bg1,
                    borderWidth: 1,
                    borderColor: T.border,
                    borderRadius: T.radiusMd,
                    padding: 12,
                    marginBottom: 10,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: T.text0, fontWeight: '800' }}>
                      {cfg.flag} {p.symbol} {p.side.toUpperCase()} {p.leverage}x
                    </Text>
                    <Text style={{ color: uPnL >= 0 ? T.green : T.red, fontWeight: '800' }}>{fmtMoney(uPnL, '$')}</Text>
                  </View>
                  <Text style={{ color: T.text3, fontSize: 11 }}>{`Held ${age} · Entry ${fmtMoney(p.entryPrice, p.currencySymbol)} · Mark ${fmtMoney(mark, p.currencySymbol)}`}</Text>
                  <Text style={{ color: T.text3, fontSize: 11 }}>{`Liq. ≈ ${fmtMoney(liq, p.currencySymbol)} · TP ${p.tp ?? '—'} / SL ${p.sl ?? '—'}`}</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                    <Pressable
                      onPress={() => {
                        setEditPos(p);
                        setTpStr(p.tp != null ? String(p.tp) : '');
                        setSlStr(p.sl != null ? String(p.sl) : '');
                      }}
                      style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: T.bg2, borderRadius: 8 }}
                    >
                      <Text style={{ color: T.yellow, fontWeight: '800', fontSize: 12 }}>Edit TP/SL</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => closePosition(p.id, mark, 'manual')}
                      style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: T.redDim, borderRadius: 8 }}
                    >
                      <Text style={{ color: T.red, fontWeight: '800', fontSize: 12 }}>Close @ mark</Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
              return [card];
            })
          )}
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: T.text0, fontWeight: '800' }}>Trade history</Text>
            <Pressable onPress={exportCsv} style={{ padding: 8 }}>
              <Text style={{ color: T.green, fontWeight: '800', fontSize: 12 }}>Export CSV</Text>
            </Pressable>
          </View>
          <View style={{ gap: 8, marginBottom: 8 }}>
            <TextInput
              placeholder="Symbol contains…"
              placeholderTextColor={T.text3}
              value={histSym}
              onChangeText={setHistSym}
              style={{
                backgroundColor: T.bg1,
                borderWidth: 1,
                borderColor: T.border,
                borderRadius: 8,
                padding: 10,
                color: T.text0,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                placeholder="From YYYY-MM-DD"
                placeholderTextColor={T.text3}
                value={histFrom}
                onChangeText={setHistFrom}
                style={{
                  flex: 1,
                  backgroundColor: T.bg1,
                  borderWidth: 1,
                  borderColor: T.border,
                  borderRadius: 8,
                  padding: 10,
                  color: T.text0,
                }}
              />
              <TextInput
                placeholder="To YYYY-MM-DD"
                placeholderTextColor={T.text3}
                value={histTo}
                onChangeText={setHistTo}
                style={{
                  flex: 1,
                  backgroundColor: T.bg1,
                  borderWidth: 1,
                  borderColor: T.border,
                  borderRadius: 8,
                  padding: 10,
                  color: T.text0,
                }}
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {(['all', 'win', 'loss'] as const).map((w) => (
                <Pressable
                  key={w}
                  onPress={() => setHistWin(w)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: histWin === w ? T.bg2 : T.bg1,
                    borderWidth: 1,
                    borderColor: histWin === w ? T.yellow : T.border,
                  }}
                >
                  <Text style={{ color: T.text1, fontSize: 12, fontWeight: '700' }}>{w}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <FlatList
            data={historyRows}
            keyExtractor={(t) => t.id}
            scrollEnabled={false}
            renderItem={({ item: t }) => (
              <View
                style={{
                  borderBottomWidth: 1,
                  borderColor: T.border,
                  paddingVertical: 10,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: T.text0, fontWeight: '700' }}>{t.symbol}</Text>
                  <Text style={{ color: T.text3, fontSize: 11 }}>{t.closedAt}</Text>
                </View>
                <Text style={{ color: t.win ? T.green : T.red, fontWeight: '800' }}>{fmtMoney(tradePnlUsd(t, rates), '$')}</Text>
              </View>
            )}
          />
        </View>
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <BannerAd slot="bottom" />
        </View>
      </ScrollView>

      {isNavRail && Platform.OS === 'web' ? (
        <View style={{ paddingTop: 12, paddingRight: 8, width: 300 }}>
          <BannerAd slot="inline" />
        </View>
      ) : null}

      {chartPos ? (
        <PositionChartModal
          visible
          onClose={() => setChartPos(null)}
          market={MARKETS[chartPos.market as MarketId]}
          tvSymbol={chartPos.tvSymbol}
          entryPrice={chartPos.entryPrice}
          tp={chartPos.tp}
          sl={chartPos.sl}
          side={chartPos.side}
          onChangeTp={(pr) => void updateTpSl(chartPos.id, pr, chartPos.sl)}
          onChangeSl={(pr) => void updateTpSl(chartPos.id, chartPos.tp, pr)}
        />
      ) : null}

      <Modal visible={!!editPos} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }} onPress={() => setEditPos(null)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: T.bg1, borderRadius: T.radiusLg, padding: 16, borderWidth: 1, borderColor: T.border }}
          >
            <Text style={{ color: T.text0, fontWeight: '800', marginBottom: 12 }}>Edit TP / SL</Text>
            <TextInput
              value={tpStr}
              onChangeText={setTpStr}
              placeholder="Take profit"
              placeholderTextColor={T.text3}
              keyboardType="decimal-pad"
              style={{ borderWidth: 1, borderColor: T.border, borderRadius: 8, padding: 10, color: T.text0, marginBottom: 8 }}
            />
            <TextInput
              value={slStr}
              onChangeText={setSlStr}
              placeholder="Stop loss"
              placeholderTextColor={T.text3}
              keyboardType="decimal-pad"
              style={{ borderWidth: 1, borderColor: T.border, borderRadius: 8, padding: 10, color: T.text0, marginBottom: 12 }}
            />
            <Pressable
              onPress={() => {
                if (!editPos) return;
                const tp = parseFloat(tpStr);
                const sl = parseFloat(slStr);
                void updateTpSl(editPos.id, isFinite(tp) ? tp : null, isFinite(sl) ? sl : null);
                setEditPos(null);
              }}
              style={{ backgroundColor: T.green, padding: 12, borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: '#000', fontWeight: '800' }}>Save</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
