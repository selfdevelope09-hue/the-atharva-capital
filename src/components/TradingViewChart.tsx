import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import {
  buildPaperTradingChartConfig,
  buildTradingViewAdvancedChartHtmlPage,
  mountTradingViewAdvancedChartWeb,
} from '@/src/utils/chart/tradingViewAdvancedChart';

export interface TradingViewChartProps {
  /** TradingView symbol, e.g. `NASDAQ:AAPL`, `BINANCE:BTCUSDT` */
  symbol: string;
  interval?: string;
  theme?: 'dark' | 'light';
  /** Min height (desktop 500, mobile 320 from parent) */
  minHeight?: number;
}

/**
 * TradingView Advanced Chart — `embed-widget-advanced-chart.js`, live data, no API key.
 */
export default function TradingViewChart({
  symbol,
  interval = '1',
  theme = 'dark',
  minHeight = 500,
}: TradingViewChartProps) {
  const hostRef = useRef<View | null>(null);

  const config = useMemo(
    () =>
      buildPaperTradingChartConfig({
        symbol,
        interval,
        theme,
        locale: 'en',
        timezone: 'Etc/UTC',
        allowSymbolChange: true,
      }),
    [symbol, interval, theme],
  );

  const html = useMemo(() => buildTradingViewAdvancedChartHtmlPage(config), [config]);
  const webKey = useMemo(() => `${symbol}|${interval}|${theme}`, [symbol, interval, theme]);

  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host) return undefined;
    const root = document.createElement('div');
    root.style.width = '100%';
    root.style.height = '100%';
    root.style.minHeight = `${Math.max(280, minHeight)}px`;
    host.innerHTML = '';
    host.appendChild(root);
    const destroy = mountTradingViewAdvancedChartWeb(root, config);
    return () => {
      destroy();
      host.innerHTML = '';
    };
  }, [config, minHeight]);

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.wrap, { minHeight }]}>
        <WebView
          key={webKey}
          originWhitelist={['*']}
          source={{ html, baseUrl: 'https://www.tradingview.com' }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          allowsInlineMediaPlayback
          setSupportMultipleWindows={false}
          androidLayerType="hardware"
        />
      </View>
    );
  }

  return (
    <View ref={hostRef} collapsable={false} style={[styles.wrap, { minHeight }]} />
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    flex: 1,
    backgroundColor: '#0d111c',
    minWidth: 0,
  },
  webview: {
    flex: 1,
    backgroundColor: '#0d111c',
  },
});
