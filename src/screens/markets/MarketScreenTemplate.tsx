/**
 * Paper-trading terminal — TradingView Advanced Chart + order rail + Firestore `trades`.
 */

import { useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { auth } from '@/config/firebaseConfig';
import { applyBalanceDelta } from '@/services/firebase/userBalancesRepository';
import {
  closePaperTrade,
  placePaperTrade,
  subscribeClosedPaperTrades,
  subscribeOpenPaperTrades,
  type PaperTradeDoc,
} from '@/services/firebase/marketPaperTradesRepository';

import type { AppMarket } from '@/constants/appMarkets';
import { MARKET_SYMBOLS, type MarketSymbolRow } from '@/src/constants/marketSymbols';
import { MARKETS as CFG, type MarketId } from '@/src/constants/markets';
import { fmtMoney, T } from '@/src/constants/theme';

import TradingViewChart from '@/src/components/TradingViewChart';
import { MarketSelector, type MarketSelectorValue } from '@/src/components/shared/MarketSelector';
import { useMarketPrices, useMarketSubscribe } from '@/src/contexts/MarketPriceContext';
import { ORDER_SHEET_BREAKPOINT } from '@/constants/theme';
import { useMultiMarketBalanceStore } from '@/store/multiMarketBalanceStore';
import { useLedgerStore } from '@/store/ledgerStore';
import { unrealizedPnlUsd } from '@/src/screens/dashboardMath';

const BG = '#0d111c';
const PANEL = '#131722';
const BORDER = '#2a2e39';
const MUTED = '#787b86';
const TV_GREEN = '#26a69a';
const TV_RED = '#ef5350';

const TIMEFRAMES = [
  { label: '1m', value: '1' },
  { label: '5m', value: '5' },
  { label: '15m', value: '15' },
  { label: '1H', value: '60' },
  { label: '4H', value: '240' },
  { label: '1D', value: 'D' },
  { label: '1W', value: 'W' },
] as const;

export interface MarketScreenTemplateProps {
  marketId: MarketId;
  title?: string;
}

type BottomTab = 'positions' | 'orders' | 'history' | 'balance';
type OrderKind = 'market' | 'limit' | 'stop';

function livePriceForRow(
  row: MarketSymbolRow | undefined,
  ticks: Record<string, { price?: number }>,
): number | null {
  if (!row?.pollKey) return null;
  const t = ticks[row.pollKey];
  const p = t?.price;
  return p != null && isFinite(p) ? p : null;
}

function grossPnl(side: 'BUY' | 'SELL', entry: number, mark: number, units: number): number {
  if (side === 'BUY') return (mark - entry) * units;
  return (entry - mark) * units;
}

export default function MarketScreenTemplate({ marketId, title }: MarketScreenTemplateProps) {
  const router = useRouter();
  const { width, height: winH } = useWindowDimensions();
  const isMobile = width < ORDER_SHEET_BREAKPOINT;
  /** Mobile: use ~45–50% of viewport height so the chart is usable (min 380). */
  const chartMinH = isMobile
    ? Math.min(580, Math.max(380, Math.floor(winH * 0.48)))
    : Math.min(560, Math.max(500, Math.floor(winH * 0.45)));

  const cfg = CFG[marketId];
  const symbols = MARKET_SYMBOLS[marketId] ?? [];
  const [selected, setSelected] = useState<MarketSymbolRow | null>(() => symbols[0] ?? null);
  const orderRow = selected ?? symbols[0] ?? null;
  const [interval, setInterval] = useState<string>('15');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<OrderKind>('market');
  const [priceStr, setPriceStr] = useState('');
  const [unitsStr, setUnitsStr] = useState('1');
  const [tpOn, setTpOn] = useState(false);
  const [slOn, setSlOn] = useState(false);
  const [tpStr, setTpStr] = useState('');
  const [slStr, setSlStr] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [bottomTab, setBottomTab] = useState<BottomTab>('positions');
  const [openTrades, setOpenTrades] = useState<(PaperTradeDoc & { id: string })[]>([]);
  const [histTrades, setHistTrades] = useState<(PaperTradeDoc & { id: string })[]>([]);

  useMarketSubscribe(marketId);
  const { ticks } = useMarketPrices();

  const balances = useMultiMarketBalanceStore((s) => s.balances);
  const balance = balances[marketId as AppMarket] ?? 0;

  const closedTrades = useLedgerStore((s) => s.closedTrades);
  const openPositions = useLedgerStore((s) => s.openPositions);
  const rates = useMultiMarketBalanceStore((s) => s.usdRates);

  const realizedLedger = useMemo(() => {
    return closedTrades
      .filter((t) => t.market === marketId)
      .reduce((a, t) => a + t.realizedPnl, 0);
  }, [closedTrades, marketId]);

  const unrealLedger = useMemo(() => {
    let u = 0;
    for (const p of openPositions.filter((x) => x.market === marketId)) {
      const mark = ticks[p.symbolFull]?.price ?? p.entryPrice;
      u += unrealizedPnlUsd(p, mark, rates);
    }
    return u;
  }, [openPositions, ticks, rates, marketId]);

  useEffect(() => {
    if (symbols.length === 0) {
      setSelected(null);
      return;
    }
    if (!selected || !symbols.find((s) => s.symbol === selected.symbol)) {
      setSelected(symbols[0]);
    }
  }, [marketId, symbols, selected]);

  const markPrice = useMemo(
    () => (orderRow ? livePriceForRow(orderRow, ticks as never) : null),
    [orderRow, ticks],
  );

  useEffect(() => {
    if (markPrice != null) setPriceStr(String(markPrice));
  }, [markPrice, orderRow?.symbol]);

  useEffect(() => {
    const unsub = subscribeOpenPaperTrades(marketId, setOpenTrades);
    return unsub;
  }, [marketId]);

  useEffect(() => {
    const unsub = subscribeClosedPaperTrades(marketId, 50, setHistTrades);
    return unsub;
  }, [marketId]);

  const navigateMarket = useCallback(
    (id: MarketSelectorValue) => {
      if (id === 'all') router.replace('/v2' as Href);
      else router.replace(`/v2/${id}` as Href);
    },
    [router],
  );

  const onPlaceOrder = async () => {
    if (!auth?.currentUser) {
      Alert.alert('Sign in', 'Sign in to place paper orders.');
      return;
    }
    const px = parseFloat(priceStr);
    const units = parseFloat(unitsStr);
    if (!isFinite(px) || px <= 0 || !isFinite(units) || units <= 0) {
      Alert.alert('Invalid', 'Enter a valid price and units.');
      return;
    }
    const tp = tpOn && tpStr.trim() ? parseFloat(tpStr) : null;
    const sl = slOn && slStr.trim() ? parseFloat(slStr) : null;
    if (tpOn && (!isFinite(tp!) || tp! <= 0)) {
      Alert.alert('TP', 'Invalid take profit.');
      return;
    }
    if (slOn && (!isFinite(sl!) || sl! <= 0)) {
      Alert.alert('SL', 'Invalid stop loss.');
      return;
    }
    if (!orderRow) {
      Alert.alert('Symbol', 'Pick a symbol.');
      return;
    }
    try {
      const id = await placePaperTrade({
        market: marketId,
        symbol: orderRow.symbol,
        pollKey: orderRow.pollKey,
        side,
        orderType,
        price: px,
        units,
        takeProfit: tp,
        stopLoss: sl,
        leverage,
      });
      if (id) Alert.alert('Order placed', `Trade ${id.slice(0, 8)}…`);
      else Alert.alert('Offline', 'Could not save to cloud.');
    } catch (e) {
      Alert.alert('Error', String((e as Error)?.message ?? e));
    }
  };

  const onCloseTrade = async (t: PaperTradeDoc & { id: string }) => {
    const mark =
      (t.pollKey && ticks[t.pollKey as never]?.price) ||
      livePriceForRow(
        symbols.find((s) => s.symbol === t.symbol),
        ticks as never,
      ) ||
      t.price;
    const pnl = grossPnl(t.side, t.price, mark, t.units);
    try {
      await closePaperTrade(t.id, mark, pnl);
      try {
        await applyBalanceDelta(marketId as AppMarket, pnl);
      } catch {
        /* balance rules */
      }
    } catch (e) {
      Alert.alert('Close failed', String((e as Error)?.message ?? e));
    }
  };

  const headerTitle = title ?? cfg.name;

  return (
    <View style={{ flex: 1, backgroundColor: BG, overflow: 'hidden' }}>
      <MarketSelector active={marketId} onChange={navigateMarket} />

      <View style={{ paddingHorizontal: 10, paddingVertical: 8, backgroundColor: PANEL, borderBottomWidth: 1, borderBottomColor: BORDER, gap: 8 }}>
        <Text style={{ color: T.text0, fontSize: 16, fontWeight: '800' }}>
          {cfg.flag} {headerTitle}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: 'row', flexWrap: 'wrap' }}>
          {symbols.map((s) => {
            const on = !!selected && s.symbol === selected.symbol;
            return (
              <Pressable
                key={s.symbol}
                onPress={() => setSelected(s)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 6,
                  backgroundColor: on ? T.yellow : 'transparent',
                  borderWidth: on ? 0 : 1,
                  borderColor: BORDER,
                }}
              >
                <Text style={{ color: on ? '#000' : T.text1, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, flexDirection: 'row' }}>
          {TIMEFRAMES.map((tf) => {
            const on = interval === tf.value;
            return (
              <Pressable
                key={tf.value}
                onPress={() => setInterval(tf.value)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 4,
                  backgroundColor: on ? 'rgba(240,185,11,0.15)' : 'transparent',
                  borderWidth: 1,
                  borderColor: on ? T.yellow : BORDER,
                }}
              >
                <Text style={{ color: on ? T.yellow : MUTED, fontSize: 11, fontWeight: '700' }}>{tf.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View
        style={{
          flex: 1,
          flexDirection: isMobile ? 'column' : 'row',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, minHeight: isMobile ? chartMinH : undefined, backgroundColor: BG }}>
          {orderRow?.symbol ? (
            <TradingViewChart symbol={orderRow.symbol} interval={interval} minHeight={chartMinH} />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <Text style={{ color: MUTED }}>No symbols for this market.</Text>
            </View>
          )}
        </View>

        <ScrollView
          style={{
            width: isMobile ? '100%' : 280,
            maxHeight: isMobile ? undefined : undefined,
            borderLeftWidth: isMobile ? 0 : 1,
            borderTopWidth: isMobile ? 1 : 0,
            borderColor: BORDER,
            backgroundColor: PANEL,
          }}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        >
          <Text style={{ color: T.text3, fontSize: 10, marginBottom: 8, letterSpacing: 0.5 }}>ORDER</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <Pressable
              onPress={() => setSide('BUY')}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 6,
                backgroundColor: side === 'BUY' ? TV_GREEN : 'transparent',
                borderWidth: 1,
                borderColor: side === 'BUY' ? TV_GREEN : BORDER,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: side === 'BUY' ? '#fff' : TV_GREEN, fontWeight: '800', fontSize: 13 }}>BUY</Text>
            </Pressable>
            <Pressable
              onPress={() => setSide('SELL')}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 6,
                backgroundColor: side === 'SELL' ? TV_RED : 'transparent',
                borderWidth: 1,
                borderColor: side === 'SELL' ? TV_RED : BORDER,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: side === 'SELL' ? '#fff' : TV_RED, fontWeight: '800', fontSize: 13 }}>SELL</Text>
            </Pressable>
          </View>

          <Text style={{ color: MUTED, fontSize: 11, marginBottom: 6 }}>Type</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
            {(['market', 'limit', 'stop'] as const).map((k) => (
              <Pressable
                key={k}
                onPress={() => setOrderType(k)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: orderType === k ? T.yellow : BORDER,
                  backgroundColor: orderType === k ? 'rgba(240,185,11,0.1)' : 'transparent',
                }}
              >
                <Text style={{ color: orderType === k ? T.yellow : T.text2, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>
                  {k}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>Price ({orderRow?.currency ?? ''})</Text>
          <TextInput
            value={priceStr}
            onChangeText={setPriceStr}
            keyboardType="decimal-pad"
            placeholder="Mark"
            placeholderTextColor={MUTED}
            style={{
              borderWidth: 1,
              borderColor: BORDER,
              borderRadius: 6,
              padding: 10,
              color: T.text0,
              marginBottom: 10,
              backgroundColor: BG,
            }}
          />

          <Text style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>Units</Text>
          <TextInput
            value={unitsStr}
            onChangeText={setUnitsStr}
            keyboardType="decimal-pad"
            style={{
              borderWidth: 1,
              borderColor: BORDER,
              borderRadius: 6,
              padding: 10,
              color: T.text0,
              marginBottom: 10,
              backgroundColor: BG,
            }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ color: MUTED, fontSize: 11 }}>Take profit</Text>
            <Pressable onPress={() => setTpOn(!tpOn)}>
              <Text style={{ color: T.yellow, fontSize: 11, fontWeight: '700' }}>{tpOn ? 'On' : 'Off'}</Text>
            </Pressable>
          </View>
          {tpOn ? (
            <TextInput
              value={tpStr}
              onChangeText={setTpStr}
              keyboardType="decimal-pad"
              placeholder="TP price"
              placeholderTextColor={MUTED}
              style={{
                borderWidth: 1,
                borderColor: BORDER,
                borderRadius: 6,
                padding: 10,
                color: T.text0,
                marginBottom: 10,
                backgroundColor: BG,
              }}
            />
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ color: MUTED, fontSize: 11 }}>Stop loss</Text>
            <Pressable onPress={() => setSlOn(!slOn)}>
              <Text style={{ color: T.yellow, fontSize: 11, fontWeight: '700' }}>{slOn ? 'On' : 'Off'}</Text>
            </Pressable>
          </View>
          {slOn ? (
            <TextInput
              value={slStr}
              onChangeText={setSlStr}
              keyboardType="decimal-pad"
              placeholder="SL price"
              placeholderTextColor={MUTED}
              style={{
                borderWidth: 1,
                borderColor: BORDER,
                borderRadius: 6,
                padding: 10,
                color: T.text0,
                marginBottom: 10,
                backgroundColor: BG,
              }}
            />
          ) : null}

          <Text style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>
            Leverage (max {cfg.maxLeverage}x)
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {[1, 2, 5, 10, 25, Math.min(cfg.maxLeverage, 50)].filter((n, i, a) => a.indexOf(n) === i && n <= cfg.maxLeverage).map((lv) => (
              <Pressable
                key={lv}
                onPress={() => setLeverage(lv)}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: leverage === lv ? T.yellow : BORDER,
                  backgroundColor: leverage === lv ? 'rgba(240,185,11,0.12)' : 'transparent',
                }}
              >
                <Text style={{ color: leverage === lv ? T.yellow : T.text2, fontSize: 11 }}>{lv}x</Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ color: MUTED, fontSize: 11, marginBottom: 8 }}>
            Available:{' '}
            <Text style={{ color: T.text0, fontWeight: '800' }}>
              {fmtMoney(balance, cfg.currencySymbol)}
            </Text>
          </Text>
          {markPrice != null ? (
            <Text style={{ color: MUTED, fontSize: 10, marginBottom: 8 }}>Live {fmtMoney(markPrice, cfg.currencySymbol)}</Text>
          ) : null}

          <Pressable
            onPress={() => void onPlaceOrder()}
            disabled={!orderRow}
            style={{
              paddingVertical: 14,
              borderRadius: 8,
              backgroundColor: side === 'BUY' ? TV_GREEN : TV_RED,
              alignItems: 'center',
              opacity: orderRow ? 1 : 0.45,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
              Place {side} {orderType.toUpperCase()}
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Account strip */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 12,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderTopWidth: 1,
          borderColor: BORDER,
          backgroundColor: BG,
        }}
      >
        <Text style={{ fontSize: 11, color: MUTED }}>
          Balance{' '}
          <Text style={{ color: '#d1d4dc', fontWeight: '800' }}>{fmtMoney(balance, cfg.currencySymbol)}</Text>
        </Text>
        <Text style={{ fontSize: 11, color: MUTED }}>
          Ledger realized{' '}
          <Text style={{ color: realizedLedger >= 0 ? TV_GREEN : TV_RED, fontWeight: '800' }}>
            {realizedLedger >= 0 ? '+' : ''}
            {fmtMoney(realizedLedger, cfg.currencySymbol)}
          </Text>
        </Text>
        <Text style={{ fontSize: 11, color: MUTED }}>
          Unrealized (ledger){' '}
          <Text style={{ color: unrealLedger >= 0 ? TV_GREEN : TV_RED, fontWeight: '800' }}>
            {unrealLedger >= 0 ? '+' : ''}
            {fmtMoney(unrealLedger, '$')}
          </Text>
        </Text>
      </View>

      {/* Bottom panel */}
      <View style={{ height: isMobile ? 180 : 200, borderTopWidth: 1, borderColor: BORDER, backgroundColor: PANEL }}>
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER }}>
          {(['positions', 'orders', 'history', 'balance'] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setBottomTab(tab)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderBottomWidth: bottomTab === tab ? 2 : 0,
                borderBottomColor: T.yellow,
              }}
            >
              <Text style={{ color: bottomTab === tab ? T.text0 : MUTED, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10 }}>
          {bottomTab === 'positions' && (
            <>
              {!auth?.currentUser ? (
                <Text style={{ color: MUTED, fontSize: 12 }}>Sign in to sync positions.</Text>
              ) : openTrades.length === 0 ? (
                <Text style={{ color: MUTED, fontSize: 12 }}>No open paper trades.</Text>
              ) : (
                openTrades.map((t) => {
                  const row = symbols.find((s) => s.symbol === t.symbol);
                  const mark =
                    (t.pollKey && ticks[t.pollKey]?.price) ||
                    livePriceForRow(row, ticks as never) ||
                    t.price;
                  const uPnL = grossPnl(t.side, t.price, mark, t.units);
                  const profit = uPnL >= 0;
                  return (
                    <View
                      key={t.id}
                      style={{
                        padding: 10,
                        marginBottom: 8,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: BORDER,
                        backgroundColor: profit ? 'rgba(38,166,154,0.08)' : 'rgba(239,83,80,0.08)',
                      }}
                    >
                      <Text style={{ color: T.text0, fontSize: 12, fontWeight: '800' }} numberOfLines={1}>
                        {t.symbol} · {t.side} · {t.units} @ {fmtMoney(t.price, cfg.currencySymbol)}
                      </Text>
                      <Text style={{ color: profit ? TV_GREEN : TV_RED, fontSize: 11, marginTop: 4 }}>
                        uPnL {profit ? '+' : ''}
                        {fmtMoney(uPnL, cfg.currencySymbol)}
                      </Text>
                      <Pressable onPress={() => void onCloseTrade(t)} style={{ marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: BG, borderRadius: 4, borderWidth: 1, borderColor: BORDER }}>
                        <Text style={{ color: T.text0, fontSize: 11, fontWeight: '700' }}>Close</Text>
                      </Pressable>
                    </View>
                  );
                })
              )}
            </>
          )}
          {bottomTab === 'orders' && (
            <Text style={{ color: MUTED, fontSize: 12 }}>Limit/stop orders execute in the main trade flow. Paper stops stored on the trade row.</Text>
          )}
          {bottomTab === 'history' && (
            <>
              {histTrades.length === 0 ? (
                <Text style={{ color: MUTED, fontSize: 12 }}>No closed paper trades yet.</Text>
              ) : (
                histTrades.map((t) => (
                  <View key={t.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER }}>
                    <Text style={{ color: T.text2, fontSize: 11 }}>{t.symbol}</Text>
                    <Text style={{ color: (t.pnl ?? 0) >= 0 ? TV_GREEN : TV_RED, fontSize: 11 }}>
                      PnL {fmtMoney(t.pnl ?? 0, cfg.currencySymbol)} @ {t.closePrice != null ? fmtMoney(t.closePrice, cfg.currencySymbol) : '—'}
                    </Text>
                  </View>
                ))
              )}
            </>
          )}
          {bottomTab === 'balance' && (
            <Text style={{ color: MUTED, fontSize: 12 }}>
              Wallet balance updates when you close a paper trade (cloud balance). Main portfolio also uses the Ledger tab under Dashboard.
            </Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
