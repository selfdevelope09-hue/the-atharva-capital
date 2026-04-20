import React from 'react';
import { Platform, Text, View } from 'react-native';

import { T } from '@/src/constants/theme';

/** Placeholder slots for AdSense / GAM — swap inner View for real script tags on web build. */
export function WebLeaderboardTopBanner() {
  if (Platform.OS !== 'web') return null;
  return (
    <View
      style={{
        minHeight: 90,
        marginBottom: 12,
        backgroundColor: T.bg1,
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: T.radiusMd,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 12,
      }}
    >
      <Text style={{ color: '#7b8390', fontSize: 10, fontWeight: '800' }}>ADSENSE · TOP BANNER</Text>
      <Text style={{ color: T.text3, fontSize: 11, marginTop: 6, textAlign: 'center' }}>728×90 / responsive slot (web)</Text>
    </View>
  );
}

export function WebDashboardSidebarRail() {
  if (Platform.OS !== 'web') return null;
  return (
    <View
      style={{
        width: 300,
        alignSelf: 'flex-start',
        minHeight: 600,
        backgroundColor: T.bg1,
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: T.radiusMd,
        padding: 12,
        position: 'sticky' as const,
        top: 12,
        zIndex: 2,
      }}
    >
      <Text style={{ color: '#7b8390', fontSize: 10, fontWeight: '800' }}>ADSENSE · SIDEBAR</Text>
      <Text style={{ color: T.text3, fontSize: 11, marginTop: 8 }}>Sticky / scroll companion placement (300×600)</Text>
    </View>
  );
}
