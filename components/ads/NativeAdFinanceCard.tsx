/**
 * Native placement styled like a stock card — subtle Sponsored label (#7b8390).
 */

import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { fetchNextAd, type NativeAd } from '@/services/ads/AdAggregator';
import { T } from '@/src/constants/theme';

const SPONSORED = '#7b8390';

export type NativeAdFinanceCardProps = {
  ad?: NativeAd;
};

export function NativeAdFinanceCard({ ad: adProp }: NativeAdFinanceCardProps) {
  const ad = useMemo(() => adProp ?? fetchNextAd(), [adProp?.id]);
  return (
    <View
      style={{
        backgroundColor: T.bg1,
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: T.radiusLg,
        padding: 14,
        marginBottom: 12,
      }}
    >
      <Text style={{ color: SPONSORED, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }}>SPONSORED</Text>
      <Text style={{ color: T.text0, fontSize: 15, fontWeight: '800', marginTop: 6 }}>{ad.title}</Text>
      <Text style={{ color: T.text2, fontSize: 12, marginTop: 6, lineHeight: 18 }}>{ad.description}</Text>
      <Text style={{ color: T.text3, fontSize: 11, marginTop: 8 }}>{ad.sponsor}</Text>
      <Pressable style={{ alignSelf: 'flex-start', marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: T.bg2, borderRadius: T.radiusSm }}>
        <Text style={{ color: T.green, fontSize: 12, fontWeight: '800' }}>{ad.ctaText}</Text>
      </Pressable>
    </View>
  );
}
