import { useRouter, type Href } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { MarketConfig, yahooSymbolFor } from '../../constants/markets';
import { T } from '../../constants/theme';
import { useMarketPrices, useMarketSubscribe } from '../../contexts/MarketPriceContext';
import { PriceCard } from '../shared/PriceCard';
import { TickerBar } from '../shared/TickerBar';

export interface MarketScreenProps {
  market: MarketConfig;
}

export function MarketScreen({ market }: MarketScreenProps) {
  useMarketSubscribe(market.id);
  const { ticks } = useMarketPrices();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    return market.pairs.map((ticker) => {
      const full = market.dataSource === 'binance_websocket' ? ticker : yahooSymbolFor(market, ticker);
      const t = ticks[full];
      return {
        ticker,
        full,
        price: t?.price ?? null,
        changePct: t?.changePct ?? null,
        volume: t?.volume ?? null,
      };
    });
  }, [market, ticks]);

  const filtered = query.trim()
    ? rows.filter((r) => r.ticker.toLowerCase().includes(query.trim().toLowerCase()))
    : rows;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      <TickerBar market={market} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 28 }}>{market.flag}</Text>
            <Text style={{ color: T.text0, fontSize: 22, fontWeight: '800' }}>{market.name}</Text>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: T.bg2 }}>
              <Text style={{ color: market.accentColor ?? T.yellow, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 }}>
                {market.vibe.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={{ color: T.text2, fontSize: 12 }}>
            {market.currency} · {market.hours ?? ''} · Max leverage {market.maxLeverage}x
          </Text>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${market.pairs.length} pairs…`}
          placeholderTextColor={T.text3}
          style={{
            backgroundColor: T.bg1,
            borderWidth: 1,
            borderColor: T.border,
            borderRadius: T.radiusMd,
            color: T.text0,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 14,
          }}
        />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {filtered.map((r) => (
            <PriceCard
              key={r.full}
              market={market}
              ticker={r.ticker}
              symbolFull={r.full}
              price={r.price}
              changePct={r.changePct}
              volume={r.volume}
              onPress={() => router.push(`/v2/${market.id}/trade?symbol=${encodeURIComponent(r.ticker)}` as Href)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
