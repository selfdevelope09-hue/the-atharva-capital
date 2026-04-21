/**
 * Markets tab — entry point to all 9 live market screens.
 * Navigates into /v2/[marketId] which renders MarketScreenTemplate
 * with: live Yahoo Finance prices, LeftSidebar watchlists (desktop),
 * BottomPanel positions/history, and Trade → ChartWithOverlay pre-trade drag.
 */
import { useRouter, type Href } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { MARKETS, MARKET_IDS, yahooSymbolFor, type MarketId } from '@/src/constants/markets';
import { T, fmtMoney, fmtPct } from '@/src/constants/theme';
import { useMarketPrices, useMarketSubscribe } from '@/src/contexts/MarketPriceContext';
import { useLedgerStore } from '@/store/ledgerStore';
import { useMultiMarketBalanceStore } from '@/store/multiMarketBalanceStore';

/** One subscriber per market — each mounts a separate hook instance */
function MarketSubscriber({ id }: { id: MarketId }) {
  useMarketSubscribe(id);
  return null;
}

function MarketCard({ id }: { id: MarketId }) {
  const router = useRouter();
  const m = MARKETS[id];
  const { ticks } = useMarketPrices();

  const openPositions = useLedgerStore((s) => s.openPositions);
  const balances = useMultiMarketBalanceStore((s) => s.balances);

  const posCount = useMemo(
    () => openPositions.filter((p) => p.market === id).length,
    [openPositions, id]
  );

  const balance = balances[id] ?? 0;

  // Show first pair's tick as a quick live price
  const firstPair = m.pairs[0];
  const firstFull =
    m.dataSource === 'binance_websocket' ? firstPair : yahooSymbolFor(m, firstPair);
  const tick = ticks[firstFull] ?? ticks[firstPair];
  const livePrice = tick?.price ?? null;
  const livePct = tick?.changePct ?? null;
  const priceUp = (livePct ?? 0) >= 0;

  return (
    <Pressable
      onPress={() => router.push(`/v2/${id}` as Href)}
      style={({ pressed }) => ({
        flexGrow: 1,
        flexBasis: 200,
        maxWidth: 340,
        padding: 16,
        backgroundColor: pressed ? T.bg2 : T.bg1,
        borderWidth: 1.5,
        borderColor: pressed ? (m.accentColor ?? T.yellow) : T.border,
        borderRadius: T.radiusLg,
      })}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Text style={{ fontSize: 26 }}>{m.flag}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.text0, fontSize: 15, fontWeight: '800' }}>{m.name}</Text>
          <Text style={{ color: T.text2, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
            {m.currency} · {m.pairs.length} pairs · {m.maxLeverage}x
          </Text>
        </View>
        {posCount > 0 && (
          <View
            style={{
              backgroundColor: T.greenDim,
              borderRadius: 999,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text style={{ color: T.green, fontSize: 10, fontWeight: '800' }}>{posCount} open</Text>
          </View>
        )}
      </View>

      {/* Live price row */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        {livePrice != null ? (
          <>
            <Text style={{ color: T.text0, fontSize: 16, fontWeight: '700' }}>
              {fmtMoney(livePrice, m.currencySymbol)}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: priceUp ? T.green : T.red,
              }}
            >
              {fmtPct(livePct)}
            </Text>
          </>
        ) : (
          <Text style={{ color: T.text3, fontSize: 12 }}>Loading…</Text>
        )}
      </View>

      {/* Pair chips */}
      <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
        {m.pairs.slice(0, 5).map((p) => (
          <View
            key={p}
            style={{
              paddingHorizontal: 7,
              paddingVertical: 2,
              backgroundColor: T.bg2,
              borderRadius: T.radiusSm,
            }}
          >
            <Text style={{ color: T.text1, fontSize: 10, fontWeight: '700' }}>{p}</Text>
          </View>
        ))}
        {m.pairs.length > 5 && (
          <Text style={{ color: T.text3, fontSize: 10, alignSelf: 'center' }}>
            +{m.pairs.length - 5}
          </Text>
        )}
      </View>

      {/* Balance + CTA */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: T.text2, fontSize: 11 }}>
          Balance:{' '}
          <Text style={{ color: T.yellow, fontWeight: '700' }}>
            {fmtMoney(balance, m.currencySymbol)}
          </Text>
        </Text>
        <Text style={{ color: m.accentColor ?? T.yellow, fontSize: 11, fontWeight: '800' }}>
          Open →
        </Text>
      </View>
    </Pressable>
  );
}

export default function MarketsHub() {
  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      {MARKET_IDS.map((id) => <MarketSubscriber key={id} id={id} />)}

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 48,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingTop: 8, paddingBottom: 4 }}>
          <Text style={{ color: T.text0, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>
            ⚡ Atharva Capital
          </Text>
          <Text style={{ color: T.text2, fontSize: 13, marginTop: 4 }}>
            9 Global Markets · Live Yahoo Finance + Binance prices · TradingView Charts
          </Text>
        </View>

        {/* Feature badges */}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[
            ['📊', 'Live Prices'],
            ['📋', 'Watchlists'],
            ['💼', 'Positions'],
            ['📍', 'Chart Drag'],
          ].map(([icon, label]) => (
            <View
              key={label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 10,
                paddingVertical: 5,
                backgroundColor: T.bg1,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: T.border,
              }}
            >
              <Text style={{ fontSize: 12 }}>{icon}</Text>
              <Text style={{ color: T.text1, fontSize: 11, fontWeight: '600' }}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Market grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {MARKET_IDS.map((id) => (
            <MarketCard key={id} id={id} />
          ))}
        </View>

        <Text style={{ color: T.text3, fontSize: 11, textAlign: 'center', paddingTop: 8 }}>
          Tap any market to open the full terminal with live prices, sidebar watchlists,
          positions panel, and chart order entry.
        </Text>
      </ScrollView>
    </View>
  );
}
