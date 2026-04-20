import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { MarketConfig, yahooSymbolFor } from '../../constants/markets';
import { fmtMoney, fmtPct, T } from '../../constants/theme';
import { useMarketPrices } from '../../contexts/MarketPriceContext';

export interface TickerBarProps {
  market: MarketConfig;
}

export function TickerBar({ market }: TickerBarProps) {
  const { ticks } = useMarketPrices();
  const symbols = useMemo(() => {
    if (market.dataSource === 'binance_websocket') return market.pairs;
    return market.pairs.map((p) => yahooSymbolFor(market, p));
  }, [market]);

  const anim = useRef(new Animated.Value(0)).current;
  const [rowW, setRowW] = useState(0);

  useEffect(() => {
    if (!rowW) return;
    anim.setValue(0);
    const duration = Math.max(rowW * 22, 14000);
    Animated.loop(
      Animated.timing(anim, {
        toValue: -rowW,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [rowW, anim]);

  const items = useMemo(() => {
    return symbols.map((s, i) => {
      const t = ticks[s];
      const display = market.dataSource === 'binance_websocket' ? s.replace(/USDT$/, '') : market.pairs[i];
      return { key: s, display, price: t?.price ?? null, pct: t?.changePct ?? null };
    });
  }, [symbols, ticks, market]);

  const renderRow = (keyPrefix: string) => (
    <View
      key={keyPrefix}
      onLayout={keyPrefix === 'a' ? (e) => setRowW(e.nativeEvent.layout.width) : undefined}
      style={{ flexDirection: 'row', alignItems: 'center' }}
    >
      {items.map((it) => (
        <View key={`${keyPrefix}-${it.key}`} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 8 }}>
          <Text style={{ color: T.text1, fontSize: 12, fontWeight: '700' }}>{it.display}</Text>
          <Text style={{ color: T.text0, fontSize: 12, fontWeight: '600' }}>{fmtMoney(it.price, market.currencySymbol)}</Text>
          <Text style={{ color: (it.pct ?? 0) >= 0 ? T.green : T.red, fontSize: 12, fontWeight: '700' }}>{fmtPct(it.pct)}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={{ height: 40, backgroundColor: T.bg1, borderBottomWidth: 1, borderColor: T.border, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }}>
      <View style={{ paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.bg2, height: '100%' }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: T.green }} />
        <Text style={{ color: T.text0, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>LIVE</Text>
      </View>
      <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: anim }] }}>
        {renderRow('a')}
        {renderRow('b')}
      </Animated.View>
    </View>
  );
}
