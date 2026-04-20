/**
 * 60dp bottom banner — hidden when order form or chart interaction is active.
 */

import React, { useMemo } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { nextNetworkId } from '@/services/ads/adNetworks';
import { T } from '@/src/constants/theme';
import { useAdUxStore } from '@/store/adUxStore';

const BANNER_DP = 60;

export function SmartBanner() {
  const showChrome = useAdUxStore((s) => !s.isOrderFormOpen && !s.isChartInteracting);
  const net = useMemo(() => nextNetworkId(), [showChrome]);
  if (!showChrome) return null;

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: BANNER_DP,
        backgroundColor: T.bg1,
        borderTopWidth: 1,
        borderColor: T.border,
        justifyContent: 'center',
        paddingHorizontal: 12,
        zIndex: 50,
        ...(Platform.OS === 'web' ? { position: 'fixed' as const } : {}),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#7b8390', fontSize: 9, fontWeight: '800' }}>SPONSORED · {net}</Text>
          <Text style={{ color: T.text1, fontSize: 12, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>
            Smart execution routes · Tap to learn more
          </Text>
        </View>
        <Pressable style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: T.bg2, borderRadius: 8 }}>
          <Text style={{ color: T.yellow, fontSize: 20, fontWeight: '800' }}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}
