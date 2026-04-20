import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MarketConfig } from '../../constants/markets';
import { fmtCompact, fmtMoney, fmtPct, T } from '../../constants/theme';

export interface PriceCardProps {
  market: MarketConfig;
  ticker: string;
  symbolFull: string;
  price: number | null;
  changePct: number | null;
  volume: number | null;
  onPress?: () => void;
}

export function PriceCard({ market, ticker, price, changePct, volume, onPress }: PriceCardProps) {
  const [hover, setHover] = useState(false);
  const up = (changePct ?? 0) >= 0;
  const accent = market.accentColor ?? T.yellow;

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={({ pressed }) => ({
        flexGrow: 1,
        flexBasis: 220,
        backgroundColor: T.bg1,
        borderWidth: 1,
        borderColor: hover || pressed ? accent : T.border,
        borderRadius: T.radiusLg,
        padding: 14,
        transform: [{ translateY: hover ? -2 : 0 }],
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: T.text0, fontSize: 14, fontWeight: '800' }}>{ticker}</Text>
        <View style={{ backgroundColor: up ? T.greenDim : T.redDim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
          <Text style={{ color: up ? T.green : T.red, fontSize: 11, fontWeight: '700' }}>{fmtPct(changePct)}</Text>
        </View>
      </View>
      <Text style={{ color: T.text0, fontSize: 22, fontWeight: '700', marginTop: 10 }}>{fmtMoney(price, market.currencySymbol)}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
        <Text style={{ color: T.text3, fontSize: 11 }}>Vol</Text>
        <Text style={{ color: T.text2, fontSize: 11, fontWeight: '600' }}>{fmtCompact(volume)}</Text>
      </View>
      <View style={{ marginTop: 12, alignSelf: 'flex-start', backgroundColor: T.bg2, paddingHorizontal: 10, paddingVertical: 6, borderRadius: T.radiusSm }}>
        <Text style={{ color: accent, fontSize: 11, fontWeight: '700' }}>Trade →</Text>
      </View>
    </Pressable>
  );
}
