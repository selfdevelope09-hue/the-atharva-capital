import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { T } from '@/src/constants/theme';

type Props = {
  symbol: string;
  lastPrice: number | null;
  side: 'ce' | 'pe';
  onToggleSide: (s: 'ce' | 'pe') => void;
};

/** Compact option-chain style grid (demo strikes / OI — not live OPRA). */
export function OptionChainPanel({ symbol, lastPrice, side, onToggleSide }: Props) {
  const strikes = useMemo(() => {
    const p = lastPrice && lastPrice > 0 ? lastPrice : 100;
    const step = Math.max(1, Math.round(p * 0.02));
    return [-2, -1, 0, 1, 2].map((k) => Math.round(p + k * step));
  }, [lastPrice]);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['ce', 'pe'] as const).map((s) => {
          const on = side === s;
          return (
            <Pressable
              key={s}
              onPress={() => onToggleSide(s)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: T.radiusMd,
                backgroundColor: on ? T.yellow : T.bg2,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: on ? T.yellow : T.border,
              }}
            >
              <Text style={{ color: on ? '#000' : T.text1, fontWeight: '800', fontSize: 13 }}>
                {s === 'ce' ? 'Call (CE)' : 'Put (PE)'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ color: T.text3, fontSize: 11 }}>
        {symbol} · strikes vs. mark {lastPrice != null ? lastPrice.toFixed(2) : '—'}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ borderWidth: 1, borderColor: T.border, borderRadius: T.radiusMd, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', backgroundColor: T.bg2, paddingVertical: 8, paddingHorizontal: 10, gap: 16 }}>
            <Text style={{ color: T.text2, fontSize: 10, fontWeight: '800', width: 72 }}>STRIKE</Text>
            <Text style={{ color: T.text2, fontSize: 10, fontWeight: '800', width: 56 }}>OI</Text>
            <Text style={{ color: T.text2, fontSize: 10, fontWeight: '800', width: 56 }}>IV</Text>
          </View>
          {strikes.map((strike, i) => {
            const oi = 1200 + i * 173 + (strike % 7) * 42;
            const iv = 18 + (i % 5) * 2.1;
            return (
            <View
              key={strike}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 10,
                paddingHorizontal: 10,
                gap: 16,
                borderTopWidth: 1,
                borderTopColor: T.border,
                backgroundColor: strike === Math.round(lastPrice ?? strike) ? 'rgba(240,185,11,0.08)' : T.bg0,
              }}
            >
              <Text style={{ color: T.text0, fontWeight: '700', width: 72, fontFamily: T.fontMono }}>{strike}</Text>
              <Text style={{ color: T.text1, width: 56, fontFamily: T.fontMono }}>{oi.toLocaleString()}</Text>
              <Text style={{ color: T.text1, width: 56, fontFamily: T.fontMono }}>{iv.toFixed(1)}%</Text>
            </View>
            );
          })}
        </View>
      </ScrollView>
      <Text style={{ color: T.text3, fontSize: 10 }}>
        OI / IV are illustrative. Connect a live options feed for production.
      </Text>
    </View>
  );
}
