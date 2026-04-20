/**
 * Horizontal market flag bar — active market gets yellow border (T.yellow / accent).
 */

import React from 'react';
import { Pressable, ScrollView, Text } from 'react-native';

import type { MarketId } from '../../constants/markets';
import { MARKETS, MARKET_IDS } from '../../constants/markets';
import { T } from '../../constants/theme';

export type MarketSelectorValue = MarketId | 'all';

export interface MarketSelectorProps {
  active: MarketSelectorValue;
  onChange: (id: MarketSelectorValue) => void;
  showAll?: boolean;
}

export function MarketSelector({ active, onChange, showAll = true }: MarketSelectorProps) {
  const ids: MarketSelectorValue[] = showAll ? ['all', ...MARKET_IDS] : [...MARKET_IDS];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' }}
    >
      {ids.map((id) => {
        const isAll = id === 'all';
        const label = isAll ? 'All' : MARKETS[id as MarketId].flag;
        const selected = active === id;
        const accent = !isAll ? (MARKETS[id as MarketId].accentColor ?? T.yellow) : T.yellow;
        return (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: selected ? T.bg2 : T.bg1,
              borderWidth: 2,
              borderColor: selected ? accent : T.border,
            }}
          >
            <Text style={{ fontSize: isAll ? 13 : 18 }}>{label}</Text>
            {isAll ? (
              <Text style={{ color: T.text2, fontSize: 10, fontWeight: '700', marginTop: 2 }}>ALL MKTS</Text>
            ) : (
              <Text style={{ color: T.text3, fontSize: 9, fontWeight: '600', marginTop: 2 }} numberOfLines={1}>
                {MARKETS[id as MarketId].currency}
              </Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
