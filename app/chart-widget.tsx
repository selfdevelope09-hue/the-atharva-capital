import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { AdvancedTVChart } from '@/src/components/charts/AdvancedTVChart';

/**
 * Public embed route — same chart as the trade terminal (for WebView `loadFromSite` on native).
 * Example: /chart-widget?symbol=BINANCE%3ABTCUSDT&interval=15&tz=Etc%2FUTC
 */
export default function ChartWidgetPage() {
  const { symbol, interval, tz } = useLocalSearchParams<{
    symbol?: string;
    interval?: string;
    tz?: string;
  }>();
  const [h, setH] = useState(600);
  const sym = symbol ? decodeURIComponent(String(symbol)) : 'BINANCE:BTCUSDT';
  const intv = interval != null && interval !== '' ? String(interval) : '15';
  const timezone = tz != null && tz !== '' ? decodeURIComponent(String(tz)) : 'Etc/UTC';

  return (
    <View style={{ flex: 1, backgroundColor: '#0b0e11' }} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      <AdvancedTVChart symbol={sym} interval={intv} timezone={timezone} height={Math.max(320, h)} />
    </View>
  );
}
