import type { AppMarket } from '@/constants/appMarkets';
import { SafeNativeAd } from '@/components/ads/SafeNativeAd';
import { useLedgerStore } from '@/store/ledgerStore';
import { useMultiMarketBalanceStore } from '@/store/multiMarketBalanceStore';
import { useAdUxStore } from '@/store/adUxStore';
import { useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, Text, View } from 'react-native';
import { MarketConfig, toYahooFullSymbol, tvSymbolFor } from '../../constants/markets';
import { fmtMoney, fmtPct, T } from '../../constants/theme';
import { useMarketPrices, useMarketSubscribe } from '../../contexts/MarketPriceContext';
import { BottomSheet } from '../shared/BottomSheet';
import { ChartWithOverlay, TpSl, ChartPosition } from '../shared/ChartWithOverlay';
import { OrderForm, OrderFormValue } from '../shared/OrderForm';
import { ToastContainer, useToast } from '../ui/Toast';

export interface TradeScreenProps {
  market: MarketConfig;
  ticker: string;
  balance?: number;
}

export function TradeScreen({ market, ticker, balance: balanceProp }: TradeScreenProps) {
  useMarketSubscribe(market.id);
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [screenW, setScreenW] = useState(Dimensions.get('window').width);
  const mkt = market.id as AppMarket;
  const balanceZ = useMultiMarketBalanceStore((s) => s.balances[mkt] ?? 0);
  const hydrateBalances = useMultiMarketBalanceStore((s) => s.hydrateFromCloud);
  const openFromOrder = useLedgerStore((s) => s.openFromOrder);
  const allPositions = useLedgerStore((s) => s.openPositions);
  const balance = balanceProp ?? balanceZ;

  const { toasts, show: showToast } = useToast();

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreenW(window.width));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    void hydrateBalances();
  }, [hydrateBalances]);

  useEffect(() => {
    useAdUxStore.getState().setOrderFormOpen(sheetOpen);
  }, [sheetOpen]);

  const isDesktop = screenW >= 960;
  const fullSymbol =
    market.dataSource === 'binance_websocket' ? ticker : toYahooFullSymbol(market, ticker);
  const { ticks } = useMarketPrices();
  const tick = ticks[fullSymbol];
  const lastPrice = tick?.price ?? null;

  const tvSymbol = useMemo(() => tvSymbolFor(market, ticker), [market, ticker]);

  /* ── Order form state ── */
  const [order, setOrder] = useState<OrderFormValue>(() => ({
    side: 'long',
    orderType: 'market',
    feeRole: 'taker',
    amount: 0,
    limitPrice: null,
    leverage: 1,
    tp: null,
    sl: null,
  }));

  useEffect(() => {
    if (order.tp == null && lastPrice) {
      setOrder((prev) => ({ ...prev, tp: lastPrice * 1.02, sl: lastPrice * 0.98 }));
    }
  }, [lastPrice, order.tp]);

  /* ── Pre-trade drag state ── */
  const [preTradeMode, setPreTradeMode] = useState(false);
  const [preTradeEntry, setPreTradeEntry] = useState<number | null>(null);
  const [preTradeTP, setPreTradeTP] = useState<number | null>(null);
  const [preTradeSL, setPreTradeSL] = useState<number | null>(null);

  const handleSetOnChart = useCallback(
    (entry: number, tp: number | null, sl: number | null) => {
      setPreTradeEntry(entry);
      setPreTradeTP(tp);
      setPreTradeSL(sl);
      setPreTradeMode(true);
    },
    []
  );

  const handlePreTradeConfirm = useCallback(async () => {
    const mark = preTradeEntry ?? lastPrice ?? order.limitPrice ?? 0;
    const orderWithPreTrade: OrderFormValue = {
      ...order,
      tp: preTradeTP,
      sl: preTradeSL,
    };
    const res = await openFromOrder({
      market: mkt,
      cfg: market,
      ticker,
      order: orderWithPreTrade,
      markPrice: mark,
    });
    if (res.ok) {
      showToast(`✅ ${order.side === 'long' ? 'Long' : 'Short'} opened · ${ticker}`, 'green');
      setPreTradeMode(false);
      setSheetOpen(false);
    } else {
      showToast((res as { ok: false; error: string }).error ?? 'Trade failed', 'red');
    }
  }, [preTradeEntry, preTradeTP, preTradeSL, order, lastPrice, mkt, market, ticker, openFromOrder, showToast]);

  const handlePreTradeDiscard = useCallback(() => {
    setPreTradeMode(false);
    setPreTradeEntry(null);
    setPreTradeTP(null);
    setPreTradeSL(null);
    showToast('Order discarded', 'gray');
  }, [showToast]);

  /* ── Stable callbacks for canvas (avoids effect teardown on every render) ── */
  const handlePreTradeEntryChange = useCallback((v: number) => setPreTradeEntry(v), []);
  const handlePreTradeTpChange = useCallback((v: number) => setPreTradeTP(v), []);
  const handlePreTradeSlChange = useCallback((v: number) => setPreTradeSL(v), []);

  /* ── TpSl for existing overlay (used when NOT in pre-trade mode) ── */
  const tpsl: TpSl = {
    entry: order.orderType === 'limit' && order.limitPrice ? order.limitPrice : lastPrice ?? 0,
    tp: order.tp,
    sl: order.sl,
    side: order.side,
  };

  const priceBand =
    tick?.high != null && tick?.low != null && tick.high > tick.low
      ? { high: tick.high, low: tick.low }
      : undefined;

  /* ── Open positions for this ticker (shown as chart lines) ── */
  const chartPositions = useMemo<ChartPosition[]>(
    () =>
      allPositions
        .filter((p) => p.market === mkt && p.symbol === ticker)
        .map((p) => ({
          id: p.id,
          side: p.side,
          entryPrice: p.entryPrice,
          qty: p.qty,
          margin: p.margin,
          leverage: p.leverage,
          tp: p.tp,
          sl: p.sl,
          openedAt: p.openedAt,
          currencySymbol: p.currencySymbol,
        })),
    [allPositions, mkt, ticker]
  );

  /* ── Chart element ── */
  const chart = (
    <ChartWithOverlay
      tvSymbol={tvSymbol}
      tpsl={tpsl}
      priceBand={priceBand}
      accentColor={market.accentColor ?? T.yellow}
      onChangeTp={(p) => {
        useAdUxStore.getState().pulseChartInteraction();
        setOrder((prev) => ({ ...prev, tp: p }));
      }}
      onChangeSl={(p) => {
        useAdUxStore.getState().pulseChartInteraction();
        setOrder((prev) => ({ ...prev, sl: p }));
      }}
      timezone={market.timezone ?? 'Etc/UTC'}
      height={isDesktop ? 600 : 420}
      /* Pre-trade props */
      preTradeMode={preTradeMode}
      preTradeSide={order.side}
      preTradeEntry={preTradeEntry}
      preTradeTP={preTradeTP}
      preTradeSL={preTradeSL}
      preTradeQty={order.amount}
      onPreTradeEntryChange={handlePreTradeEntryChange}
      onPreTradeTpChange={handlePreTradeTpChange}
      onPreTradeSlChange={handlePreTradeSlChange}
      onPreTradeConfirm={handlePreTradeConfirm}
      onPreTradeDiscard={handlePreTradeDiscard}
      /* Open positions */
      openPositions={chartPositions}
    />
  );

  const orderPanel = (
    <OrderForm
      market={market}
      lastPrice={lastPrice}
      balance={balance}
      value={order}
      onChange={setOrder}
      onSubmit={async (v) => {
        const mark = lastPrice ?? v.limitPrice ?? 0;
        const res = await openFromOrder({ market: mkt, cfg: market, ticker, order: v, markPrice: mark });
        if (res.ok) {
          showToast(`✅ ${v.side === 'long' ? 'Long' : 'Short'} opened · ${ticker}`, 'green');
          setSheetOpen(false);
        } else {
          showToast((res as { ok: false; error: string }).error ?? 'Trade failed', 'red');
        }
      }}
      /* Pre-trade chart mode */
      onSetOnChart={handleSetOnChart}
      chartMode={preTradeMode}
      chartEntry={preTradeEntry}
      chartTP={preTradeTP}
      chartSL={preTradeSL}
      onChartConfirm={handlePreTradeConfirm}
      onChartDiscard={handlePreTradeDiscard}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderColor: T.border, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: T.radiusSm, backgroundColor: T.bg2 }}
          >
            <Text style={{ color: T.text1, fontWeight: '700' }}>←</Text>
          </Pressable>
          <Text style={{ color: T.text0, fontSize: 18, fontWeight: '800' }}>{ticker}</Text>
          <Text style={{ color: T.text3, fontSize: 12 }}>
            {market.flag} {market.name}
          </Text>
          {preTradeMode && (
            <View style={{ marginLeft: 'auto' as any, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: T.yellow, backgroundColor: 'rgba(240,185,11,0.1)' }}>
              <Text style={{ color: T.yellow, fontSize: 11, fontWeight: '700' }}>📍 Chart Mode</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
          <Text style={{ color: T.text0, fontSize: 26, fontWeight: '800' }}>
            {fmtMoney(lastPrice, market.currencySymbol)}
          </Text>
          <Text style={{ color: (tick?.changePct ?? 0) >= 0 ? T.green : T.red, fontSize: 14, fontWeight: '700' }}>
            {fmtPct(tick?.changePct ?? null)}
          </Text>
          {tick?.marketState && <StatePill state={tick.marketState} />}
        </View>
      </View>

      {isDesktop ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} style={{ flex: 1 }}>
            {chart}
            <SafeNativeAd slotId={1} />
            <PairPicker market={market} activeTicker={ticker} />
            <SafeNativeAd slotId={2} />
          </ScrollView>
          <View style={{ width: 380, borderLeftWidth: 1, borderColor: T.border, backgroundColor: T.bg0 }}>
            <ScrollView contentContainerStyle={{ padding: 16 }}>{orderPanel}</ScrollView>
          </View>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            {chart}
            <SafeNativeAd slotId={1} />
            <PairPicker market={market} activeTicker={ticker} />
            <SafeNativeAd slotId={2} />
          </ScrollView>
          <Pressable
            onPress={() => setSheetOpen(true)}
            style={{
              position: 'absolute',
              right: 16,
              bottom: 24,
              paddingHorizontal: 18,
              paddingVertical: 14,
              borderRadius: 999,
              backgroundColor: preTradeMode ? T.yellow : (market.accentColor ?? T.yellow),
              ...T.shadow,
            }}
          >
            <Text style={{ color: '#000', fontSize: 14, fontWeight: '800' }}>
              {preTradeMode ? '📍 Chart Mode' : 'Trade ↗'}
            </Text>
          </Pressable>
          <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} heightPct={0.88}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>{orderPanel}</ScrollView>
          </BottomSheet>
        </>
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} />
    </View>
  );
}

function StatePill({ state }: { state: string }) {
  const s = state.toUpperCase();
  const up = s === 'REGULAR';
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: up ? T.greenDim : T.bg2 }}>
      <Text style={{ color: up ? T.green : T.text2, fontSize: 10, fontWeight: '800' }}>{s}</Text>
    </View>
  );
}

function PairPicker({ market, activeTicker }: { market: MarketConfig; activeTicker: string }) {
  const router = useRouter();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
      {market.pairs.map((p) => {
        const active = p === activeTicker;
        return (
          <Pressable
            key={p}
            onPress={() => router.replace(`/v2/${market.id}/trade?symbol=${encodeURIComponent(p)}` as Href)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: active ? market.accentColor ?? T.yellow : T.bg1,
              borderWidth: 1,
              borderColor: active ? market.accentColor ?? T.yellow : T.border,
            }}
          >
            <Text style={{ color: active ? '#000' : T.text1, fontSize: 12, fontWeight: '700' }}>{p}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
