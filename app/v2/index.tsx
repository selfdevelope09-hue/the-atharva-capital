import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeNativeAd } from '@/components/ads/SafeNativeAd';
import { MARKETS, MARKET_IDS } from '@/src/constants/markets';
import { T } from '@/src/constants/theme';

export default function V2Hub() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}>
        <View>
          <Text style={{ color: T.text0, fontSize: 26, fontWeight: '800' }}>9 Markets</Text>
          <Text style={{ color: T.text2, fontSize: 13, marginTop: 4 }}>
            Unified terminal — Binance WS + Yahoo Finance polling · TradingView Advanced Charts
          </Text>
        </View>

        <SafeNativeAd slotId={1} />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {MARKET_IDS.map((id) => {
            const m = MARKETS[id];
            return (
              <Pressable
                key={id}
                onPress={() => router.push(`/v2/${id}` as Href)}
                style={({ hovered, pressed }) => ({
                  flexGrow: 1,
                  flexBasis: 240,
                  padding: 16,
                  backgroundColor: T.bg1,
                  borderWidth: 1,
                  borderColor: hovered || pressed ? m.accentColor ?? T.yellow : T.border,
                  borderRadius: T.radiusLg,
                  transform: [{ translateY: hovered ? -2 : 0 }],
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 24 }}>{m.flag}</Text>
                  <Text style={{ color: T.text0, fontSize: 16, fontWeight: '800' }}>{m.name}</Text>
                </View>
                <Text style={{ color: T.text2, fontSize: 12, marginTop: 6 }}>
                  {m.vibe} · {m.currency} · {m.pairs.length} pairs · up to {m.maxLeverage}x
                </Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {m.pairs.slice(0, 4).map((p) => (
                    <View key={p} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: T.bg2, borderRadius: T.radiusSm }}>
                      <Text style={{ color: T.text1, fontSize: 10, fontWeight: '700' }}>{p}</Text>
                    </View>
                  ))}
                </View>
                <Text style={{ color: m.accentColor ?? T.yellow, fontSize: 11, fontWeight: '800', marginTop: 12 }}>Open →</Text>
              </Pressable>
            );
          })}
        </View>

        <SafeNativeAd slotId={2} />
        <SafeNativeAd slotId={3} />
        <SafeNativeAd slotId={4} />
      </ScrollView>
    </View>
  );
}
