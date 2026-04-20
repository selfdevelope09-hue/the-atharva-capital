import FontAwesome from '@expo/vector-icons/FontAwesome';
import { memo, useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import type { ActiveMarket } from '@/store/marketStore';
import {
  defaultSymbolForMarket,
  mapToTradingViewSymbol,
  tradingViewLocaleForMarket,
  tradingViewTimezoneForMarket,
} from '@/utils/chart/symbolMapper';

/**
 * Universal TradingView Advanced Widget.
 *
 * - Web  → injects `https://s3.tradingview.com/tv.js` into a container <div>
 *          and instantiates `new TradingView.widget({...})` for true 1:1
 *          parity with tradingview.com (drawing tools, studies, MTF, etc.).
 * - iOS / Android → renders a `<WebView>` whose HTML loads the same script.
 *
 * The widget takes 100% of its parent's width/height and plays nicely inside
 * the `FullScreenTerminal` modal next to our Exness-style order rail.
 */

// ---------------------------------------------------------------------------
// Public types
//
// Kept shape-compatible with the previous lightweight-chart contract so every
// dashboard call-site keeps compiling. Fields the TradingView widget manages
// on its own (bars data, indicator toggles, draggable TP/SL) are still
// accepted but intentionally ignored — TradingView owns the chart state now.
// ---------------------------------------------------------------------------

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
  /** Legacy: bar data used by the old lightweight-chart. Ignored by TradingView. */
  data?: UniversalChartBar[];
  colorTheme?: 'dark' | 'light';
  market: ActiveMarket;
  /** Ticker to display. Mapped to a TradingView exchange-prefixed symbol. */
  symbol?: string;
  /** TradingView interval: `1`, `5`, `15`, `60`, `240`, `D`, `W`, `M`. */
  interval?: string;
  /** Minimum chart height (px). Width follows container. */
  minHeight?: number;
  /** Legacy — handled natively by TradingView. */
  seriesPresentation?: ChartSeriesPresentation;
  riskOverlay?: UniversalChartRiskOverlay | null;
  livePrice?: number;
  quoteCurrency?: string;
  positionQty?: number;
  positionSide?: 'long' | 'short';
  onRiskChange?: (patch: { takeProfit?: number; stopLoss?: number }) => void;
  indicators?: ChartIndicatorToggles;
  /** Pro terminal: expand control (top-right). */
  showFullscreenButton?: boolean;
  onFullscreenPress?: () => void;
};

// ---------------------------------------------------------------------------
// TradingView widget config — shared between web and native.
// ---------------------------------------------------------------------------

type TvConfig = {
  symbol: string;
  interval: string;
  theme: 'dark' | 'light';
  locale: string;
  timezone: string;
  containerId: string;
};

function tvBaseConfigJson(cfg: TvConfig, autosizeField: 'autosize' | 'widthHeight'): string {
  const size =
    autosizeField === 'autosize'
      ? `"autosize": true`
      : `"width": "100%", "height": "100%"`;
  return `{
    ${size},
    "symbol": ${JSON.stringify(cfg.symbol)},
    "interval": ${JSON.stringify(cfg.interval)},
    "timezone": ${JSON.stringify(cfg.timezone)},
    "theme": ${JSON.stringify(cfg.theme)},
    "style": "1",
    "locale": ${JSON.stringify(cfg.locale)},
    "toolbar_bg": "#0a0a0a",
    "enable_publishing": false,
    "hide_top_toolbar": false,
    "hide_side_toolbar": false,
    "allow_symbol_change": true,
    "withdateranges": true,
    "save_image": false,
    "studies": ["RSI@tv-basicstudies", "MACD@tv-basicstudies"],
    "container_id": ${JSON.stringify(cfg.containerId)}
  }`;
}

function buildNativeHtml(cfg: TvConfig): string {
  return `<!DOCTYPE html>
<html lang="${cfg.locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; width: 100%; background: #0a0a0a; overflow: hidden; }
    #${cfg.containerId} { height: 100vh; width: 100vw; }
    ::-webkit-scrollbar { display: none; width: 0; height: 0; }
    body { -ms-overflow-style: none; scrollbar-width: none; }
  </style>
</head>
<body>
  <div id="${cfg.containerId}"></div>
  <script src="https://s3.tradingview.com/tv.js"></script>
  <script>
    (function () {
      function boot() {
        if (typeof TradingView === 'undefined' || !TradingView.widget) {
          setTimeout(boot, 60);
          return;
        }
        try {
          new TradingView.widget(${tvBaseConfigJson(cfg, 'autosize')});
        } catch (e) {
          // swallow — the embedded widget surfaces its own errors
        }
      }
      boot();
    })();
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Web implementation
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: Record<string, unknown>) => unknown;
    };
  }
}

const TV_SCRIPT_SRC = 'https://s3.tradingview.com/tv.js';
let tvScriptPromise: Promise<void> | null = null;

function loadTradingViewScript(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  if (window.TradingView?.widget) return Promise.resolve();
  if (tvScriptPromise) return tvScriptPromise;
  tvScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${TV_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('tv.js failed')), {
        once: true,
      });
      if (window.TradingView?.widget) resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = TV_SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      tvScriptPromise = null;
      reject(new Error('tv.js failed'));
    };
    document.head.appendChild(s);
  });
  return tvScriptPromise;
}

function UniversalChartWeb(props: UniversalChartProps) {
  const { market, symbol, interval = 'D', colorTheme = 'dark', minHeight = 240 } = props;
  const hostRef = useRef<View | null>(null);
  const containerId = useMemo(
    () => `tv_host_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`,
    []
  );

  const tvSymbol = useMemo(
    () => (symbol ? mapToTradingViewSymbol(market, symbol) : defaultSymbolForMarket(market)),
    [market, symbol]
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host) return;

    let cancelled = false;

    host.innerHTML = '';
    const inner = document.createElement('div');
    inner.id = containerId;
    inner.style.width = '100%';
    inner.style.height = '100%';
    host.appendChild(inner);

    loadTradingViewScript()
      .then(() => {
        if (cancelled) return;
        const TV = window.TradingView;
        if (!TV?.widget) return;
        new TV.widget({
          autosize: true,
          symbol: tvSymbol,
          interval,
          timezone: tradingViewTimezoneForMarket(market),
          theme: colorTheme,
          style: '1',
          locale: tradingViewLocaleForMarket(market),
          toolbar_bg: '#0a0a0a',
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_side_toolbar: false,
          allow_symbol_change: true,
          withdateranges: true,
          save_image: false,
          studies: ['RSI@tv-basicstudies', 'MACD@tv-basicstudies'],
          container_id: containerId,
        });
      })
      .catch(() => {
        /* surfaced by the widget script itself */
      });

    return () => {
      cancelled = true;
      if (host) host.innerHTML = '';
    };
  }, [containerId, tvSymbol, interval, colorTheme, market]);

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

// ---------------------------------------------------------------------------
// Native implementation
// ---------------------------------------------------------------------------

function UniversalChartNative(props: UniversalChartProps) {
  const { market, symbol, interval = 'D', colorTheme = 'dark', minHeight = 240 } = props;

  const tvSymbol = useMemo(
    () => (symbol ? mapToTradingViewSymbol(market, symbol) : defaultSymbolForMarket(market)),
    [market, symbol]
  );

  const html = useMemo(
    () =>
      buildNativeHtml({
        symbol: tvSymbol,
        interval,
        theme: colorTheme,
        locale: tradingViewLocaleForMarket(market),
        timezone: tradingViewTimezoneForMarket(market),
        containerId: 'tv_native_host',
      }),
    [tvSymbol, interval, colorTheme, market]
  );

  const webKey = useMemo(() => `${tvSymbol}|${interval}|${colorTheme}`, [
    tvSymbol,
    interval,
    colorTheme,
  ]);

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

// ---------------------------------------------------------------------------
// Shared fullscreen button (sits above iframe / WebView without blocking touches).
// ---------------------------------------------------------------------------

function FullscreenAffordance({
  showFullscreenButton,
  onFullscreenPress,
}: UniversalChartProps) {
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

// ---------------------------------------------------------------------------
// Platform-aware dispatcher
// ---------------------------------------------------------------------------

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
