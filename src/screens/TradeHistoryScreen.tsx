/**
 * Full trade history — filters closed trades from ledger store.
 */

import type { AppMarket } from '@/constants/appMarkets';
import { ALL_APP_MARKETS } from '@/constants/appMarkets';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';

import { MARKETS, type MarketId } from '@/src/constants/markets';
import { T } from '@/src/constants/theme';
import { useLedgerStore } from '@/store/ledgerStore';

export function TradeHistoryScreen() {
  const closed = useLedgerStore((s) => s.closedTrades);
  const [market, setMarket] = useState<AppMarket | 'all'>('all');
  const [filter, setFilter] = useState<'all' | 'win' | 'loss'>('all');

  const rows = useMemo(() => {
    let r = [...closed].sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
    if (market !== 'all') r = r.filter((t) => t.market === market);
    if (filter === 'win') r = r.filter((t) => t.realizedPnl > 0);
    if (filter === 'loss') r = r.filter((t) => t.realizedPnl < 0);
    return r;
  }, [closed, market, filter]);

  const header = (
    <View style={{ paddingBottom: 8 }}>
      <Text style={{ color: T.text2, fontSize: 12, marginBottom: 12 }}>
        All closed trades from your session. Filters apply client-side.
      </Text>

      <Text style={{ color: T.text3, fontSize: 11, marginBottom: 6 }}>Market</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
        {(['all', ...ALL_APP_MARKETS] as const).map((m) => {
          const on = market === m;
          return (
            <Pressable
              key={m}
              onPress={() => setMarket(m)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor: on ? T.yellow : T.bg2,
                borderWidth: 1,
                borderColor: on ? T.yellow : T.border,
              }}
            >
              <Text style={{ color: on ? '#000' : T.text1, fontSize: 10, fontWeight: '700' }}>
                {m === 'all' ? 'All' : MARKETS[m as MarketId]?.flag ?? m}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={{ color: T.text3, fontSize: 11, marginBottom: 6 }}>Result</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        {(['all', 'win', 'loss'] as const).map((f) => {
          const on = filter === f;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: on ? T.bg2 : T.bg1,
                borderWidth: 1,
                borderColor: on ? T.yellow : T.border,
              }}
            >
              <Text style={{ color: on ? T.text0 : T.text2, fontSize: 12, fontWeight: '700' }}>
                {f === 'all' ? 'All' : f === 'win' ? 'Wins' : 'Losses'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Text style={{ color: T.text3, textAlign: 'center', marginTop: 24 }}>No trades match this filter.</Text>
        }
        renderItem={({ item }) => {
          const cfg = MARKETS[item.market as MarketId];
          const sym = cfg?.currencySymbol ?? '$';
          return (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: T.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.text0, fontWeight: '700', fontSize: 13 }}>
                  {item.symbol}{' '}
                  <Text style={{ color: item.side === 'long' ? T.green : T.red }}>{item.side.toUpperCase()}</Text>
                </Text>
                <Text style={{ color: T.text3, fontSize: 11, marginTop: 2 }}>
                  {cfg?.name ?? item.market} · {new Date(item.closedAt).toLocaleString()}
                </Text>
                <Text style={{ color: T.text3, fontSize: 10, marginTop: 2 }}>
                  Entry {sym}{item.entryPrice.toFixed(4)} → Exit {sym}{item.exitPrice.toFixed(4)}
                </Text>
              </View>
              <Text style={{ color: item.realizedPnl >= 0 ? T.green : T.red, fontWeight: '800', fontSize: 13 }}>
                {item.realizedPnl >= 0 ? '+' : ''}${item.realizedPnl.toFixed(2)}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}
