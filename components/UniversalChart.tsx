import FontAwesome from '@expo/vector-icons/FontAwesome';
import { memo, useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import {
  buildAdvancedChartWidgetConfig,
  buildTradingViewAdvancedChartHtmlPage,
  mountTradingViewAdvancedChartWeb,
} from '@/src/utils/chart/tradingViewAdvancedChart';
import type { ActiveMarket } from '@/store/marketStore';
import {
  defaultSymbolForMarket,
  mapToTradingViewSymbol,
  tradingViewLocaleForMarket,
  tradingViewTimezoneForMarket,
} from '@/utils/chart/symbolMapper';

/**
 * Universal TradingView Advanced Chart (free embed: `embed-widget-advanced-chart.js`).
 * Live data from TradingView — pass a correct `EXCHANGE:SYMBOL` via `mapToTradingViewSymbol`.
 *
 * - Web  → mounts widget JSON in a &lt;script&gt; next to `.tradingview-widget-container__widget`
 * - Native → WebView loads the same pattern as static HTML
 */

export type UniversalChartBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type ChartSeriesPresentation = 'candlestick' | 'softArea';

export type UniversalChartRiskOverlay = {
  takeProfit: number;
  stopLoss: number;
  entryPrice?: number;
};

export type ChartIndicatorToggles = {
  ma20: boolean;
  ma50: boolean;
  rsi: boolean;
};

export type UniversalChartProps = {
  data?: UniversalChartBar[];
  colorTheme?: 'dark' | 'light';
  market: ActiveMarket;
  symbol?: string;
  interval?: string;
  minHeight?: number;
  seriesPresentation?: ChartSeriesPresentation;
  riskOverlay?: UniversalChartRiskOverlay | null;
  livePrice?: number;
  quoteCurrency?: string;
  positionQty?: number;
  positionSide?: 'long' | 'short';
  onRiskChange?: (patch: { takeProfit?: number; stopLoss?: number }) => void;
  indicators?: ChartIndicatorToggles;
  showFullscreenButton?: boolean;
  onFullscreenPress?: () => void;
};

function UniversalChartWeb(props: UniversalChartProps) {
  const { market, symbol, interval = 'D', colorTheme = 'dark', minHeight = 240 } = props;
  const hostRef = useRef<View | null>(null);

  const tvSymbol = useMemo(
    () => (symbol ? mapToTradingViewSymbol(market, symbol) : defaultSymbolForMarket(market)),
    [market, symbol],
  );

  const embedConfig = useMemo(
    () =>
      buildAdvancedChartWidgetConfig({
        symbol: tvSymbol,
        interval,
        theme: colorTheme,
        locale: tradingViewLocaleForMarket(market),
        timezone: tradingViewTimezoneForMarket(market),
        allowSymbolChange: true,
      }),
    [tvSymbol, interval, colorTheme, market],
  );

  const embedKey = useMemo(() => JSON.stringify(embedConfig), [embedConfig]);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host) return undefined;

    host.innerHTML = '';
    const root = document.createElement('div');
    root.style.width = '100%';
    root.style.height = '100%';
    host.appendChild(root);

    const destroy = mountTradingViewAdvancedChartWeb(root, embedConfig);

    return () => {
      destroy();
      host.innerHTML = '';
    };
  }, [embedKey, embedConfig]);

  return (
    <View
      style={[
        styles.chartBox,
        { minHeight, backgroundColor: '#0a0a0a', position: 'relative' },
      ]}
      collapsable={false}>
      <View
        ref={hostRef}
        collapsable={false}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <FullscreenAffordance {...props} />
    </View>
  );
}

function UniversalChartNative(props: UniversalChartProps) {
  const { market, symbol, interval = 'D', colorTheme = 'dark', minHeight = 240 } = props;

  const tvSymbol = useMemo(
    () => (symbol ? mapToTradingViewSymbol(market, symbol) : defaultSymbolForMarket(market)),
    [market, symbol],
  );

  const embedConfig = useMemo(
    () =>
      buildAdvancedChartWidgetConfig({
        symbol: tvSymbol,
        interval,
        theme: colorTheme,
        locale: tradingViewLocaleForMarket(market),
        timezone: tradingViewTimezoneForMarket(market),
        allowSymbolChange: true,
      }),
    [tvSymbol, interval, colorTheme, market],
  );

  const html = useMemo(
    () => buildTradingViewAdvancedChartHtmlPage(embedConfig),
    [embedConfig],
  );

  const webKey = useMemo(
    () => `${tvSymbol}|${interval}|${colorTheme}`,
    [tvSymbol, interval, colorTheme],
  );

  return (
    <View
      style={{
        position: 'relative',
        minHeight,
        width: '100%',
        flex: 1,
        alignSelf: 'stretch',
        backgroundColor: '#0a0a0a',
      }}
      collapsable={false}>
      <WebView
        key={webKey}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://www.tradingview.com' }}
        style={[styles.webview, { minHeight }]}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        allowsInlineMediaPlayback
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        scrollEnabled
        nestedScrollEnabled
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
      <FullscreenAffordance {...props} />
    </View>
  );
}

function FullscreenAffordance({ showFullscreenButton, onFullscreenPress }: UniversalChartProps) {
  if (!showFullscreenButton || !onFullscreenPress) return null;
  return (
    <Pressable
      accessibilityLabel="Full screen chart"
      onPress={onFullscreenPress}
      hitSlop={8}
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 30,
        padding: 8,
        borderRadius: 10,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
      }}>
      <FontAwesome name="expand" size={16} color="#e5e5e5" />
    </Pressable>
  );
}

function UniversalChartImpl(props: UniversalChartProps) {
  if (Platform.OS === 'web') return <UniversalChartWeb {...props} />;
  return <UniversalChartNative {...props} />;
}

export const UniversalChart = memo(UniversalChartImpl);

const styles = StyleSheet.create({
  chartBox: {
    width: '100%',
    flexGrow: 1,
    alignSelf: 'stretch',
  },
  webview: {
    flex: 1,
    width: '100%',
    backgroundColor: '#0a0a0a',
    overflow: 'hidden',
  },
});
