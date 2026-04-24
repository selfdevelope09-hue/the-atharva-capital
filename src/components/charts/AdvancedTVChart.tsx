import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

import {
  buildAdvancedChartHtmlPageWithRemountBridge,
  buildAdvancedTvWidgetConfig,
  buildWebViewRemountScript,
  mountTradingViewAdvancedChartWeb,
} from '@/src/utils/chart/tradingViewAdvancedChart';

export type AdvancedTVChartProps = {
  /** TradingView `EXCHANGE:SYMBOL` (e.g. `BINANCE:BTCUSDT`). */
  symbol: string;
  interval?: string;
  locale?: string;
  timezone?: string;
  allowSymbolChange?: boolean;
  style?: StyleProp<ViewStyle>;
  height?: number;
  /**
   * Native: load `EXPO_PUBLIC_SITE_ORIGIN` + `/chart-widget?symbol=…` (same as web build).
   * Symbol changes remount the WebView (separate from inline+inject default).
   */
  loadFromSite?: boolean;
};

const SITE = process.env.EXPO_PUBLIC_SITE_ORIGIN ?? 'https://www.theatharvacapital.com';

/**
 * Free TradingView Advanced (real-time) embed — drawing toolbar, top toolbar, and price
 * scale (where supported by the free Advanced widget). Dark theme.
 */
export function AdvancedTVChart({
  symbol,
  interval = '15',
  locale = 'en',
  timezone = 'Etc/UTC',
  allowSymbolChange = false,
  style,
  height = 480,
  loadFromSite = false,
}: AdvancedTVChartProps) {
  const config = useMemo(
    () =>
      buildAdvancedTvWidgetConfig({
        symbol,
        interval,
        theme: 'dark',
        locale,
        timezone,
        allowSymbolChange,
        studies: ['BB@tv-basicstudies', 'MASimple@tv-basicstudies'],
      }),
    [symbol, interval, locale, timezone, allowSymbolChange],
  );

  const hostRef = useRef<View | null>(null);
  const webRef = useRef<WebView | null>(null);
  const htmlRef = useRef<string | null>(null);
  if (htmlRef.current == null) {
    htmlRef.current = buildAdvancedChartHtmlPageWithRemountBridge(config);
  }
  const stableHtml = htmlRef.current;
  const nativeReadyRef = useRef(false);

  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const host = hostRef.current as unknown as HTMLDivElement | null;
    if (!host) return undefined;
    return mountTradingViewAdvancedChartWeb(host, config);
  }, [config]);

  useEffect(() => {
    if (Platform.OS === 'web' || loadFromSite) return;
    if (!nativeReadyRef.current) return;
    webRef.current?.injectJavaScript(buildWebViewRemountScript(config));
  }, [config, loadFromSite]);

  if (Platform.OS === 'web') {
    return (
      <View
        ref={hostRef}
        style={[{ width: '100%', height, backgroundColor: '#0b0e11' }, style]}
        collapsable={false}
      />
    );
  }

  if (loadFromSite) {
    const uri = `${SITE.replace(/\/$/, '')}/chart-widget?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(
      interval
    )}&tz=${encodeURIComponent(timezone)}`;
    return (
      <WebView
        key={uri}
        source={{ uri }}
        style={[{ width: '100%', height, backgroundColor: '#0b0e11' }, style as ViewStyle]}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        startInLoadingState
        originWhitelist={['*']}
        androidLayerType="hardware"
        nestedScrollEnabled={false}
      />
    );
  }

  return (
    <WebView
      ref={webRef}
      source={{ html: stableHtml, baseUrl: 'https://www.tradingview.com' }}
      style={[{ width: '100%', height, backgroundColor: '#0b0e11' }, style as ViewStyle]}
      scrollEnabled={false}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      onLoadEnd={() => {
        nativeReadyRef.current = true;
        webRef.current?.injectJavaScript(buildWebViewRemountScript(config));
      }}
      startInLoadingState
      originWhitelist={['*']}
      androidLayerType="hardware"
      nestedScrollEnabled={false}
    />
  );
}
