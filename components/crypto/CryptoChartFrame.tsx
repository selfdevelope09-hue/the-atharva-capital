import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { CRYPTO_THEME } from '@/components/crypto/cryptoTheme';
import {
  buildAdvancedChartWidgetConfig,
  buildTradingViewAdvancedChartHtmlPage,
  mountTradingViewAdvancedChartWeb,
} from '@/src/utils/chart/tradingViewAdvancedChart';

export type CryptoChartFrameProps = {
  symbol: string;
  interval?: string;
  theme?: 'dark' | 'light';
  showFullscreen?: boolean;
  onFullscreen?: () => void;
};

/**
 * TradingView Advanced Chart (`embed-widget-advanced-chart.js`) — Binance spot pair.
 */
export function CryptoChartFrame({
  symbol,
  interval = '15',
  theme = 'dark',
  showFullscreen = false,
  onFullscreen,
}: CryptoChartFrameProps) {
  const embedConfig = useMemo(
    () =>
      buildAdvancedChartWidgetConfig({
        symbol: `BINANCE:${symbol.toUpperCase()}`,
        interval,
        theme,
        locale: 'en',
        timezone: 'Etc/UTC',
        allowSymbolChange: false,
      }),
    [symbol, interval, theme],
  );

  const html = useMemo(
    () => buildTradingViewAdvancedChartHtmlPage(embedConfig),
    [embedConfig],
  );

  const embedKey = useMemo(() => JSON.stringify(embedConfig), [embedConfig]);

  if (Platform.OS === 'web') {
    return (
      <WebAdvancedChart
        embedKey={embedKey}
        embedConfig={embedConfig}
        showFullscreen={showFullscreen}
        onFullscreen={onFullscreen}
      />
    );
  }
  return (
    <NativeWebView
      html={html}
      embedKey={embedKey}
      showFullscreen={showFullscreen}
      onFullscreen={onFullscreen}
    />
  );
}

function WebAdvancedChart({
  embedKey,
  embedConfig,
  showFullscreen,
  onFullscreen,
}: {
  embedKey: string;
  embedConfig: Record<string, unknown>;
  showFullscreen: boolean;
  onFullscreen?: () => void;
}) {
  const hostRef = useRef<View | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host) return undefined;

    setReady(false);
    host.innerHTML = '';
    const root = document.createElement('div');
    root.style.width = '100%';
    root.style.height = '100%';
    host.appendChild(root);

    const destroy = mountTradingViewAdvancedChartWeb(root, embedConfig, () => setReady(true));
    const t = setTimeout(() => setReady(true), 12000);

    return () => {
      clearTimeout(t);
      destroy();
      host.innerHTML = '';
    };
  }, [embedKey, embedConfig]);

  return (
    <View
      style={{
        flex: 1,
        minHeight: 320,
        width: '100%',
        backgroundColor: CRYPTO_THEME.bg,
        position: 'relative',
      }}
      collapsable={false}>
      <View
        ref={hostRef}
        collapsable={false}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      {!ready ? <LoadingShim /> : null}
      {showFullscreen ? <FullscreenButton onPress={onFullscreen} /> : null}
    </View>
  );
}

function NativeWebView({
  html,
  embedKey,
  showFullscreen,
  onFullscreen,
}: {
  html: string;
  embedKey: string;
  showFullscreen: boolean;
  onFullscreen?: () => void;
}) {
  return (
    <View
      style={{ flex: 1, minHeight: 320, width: '100%', backgroundColor: CRYPTO_THEME.bg }}
      collapsable={false}>
      <WebView
        key={embedKey}
        source={{ html, baseUrl: 'https://www.tradingview.com' }}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        allowsInlineMediaPlayback
        originWhitelist={['*']}
        style={{ flex: 1, backgroundColor: CRYPTO_THEME.bg }}
        androidLayerType="hardware"
        setSupportMultipleWindows={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
      />
      {showFullscreen ? <FullscreenButton onPress={onFullscreen} /> : null}
    </View>
  );
}

function FullscreenButton({ onPress }: { onPress?: () => void }) {
  if (!onPress) return null;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel="Full screen chart"
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 40,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: CRYPTO_THEME.borderStrong,
        backgroundColor: 'rgba(0,0,0,0.55)',
      }}>
      <Text style={{ color: CRYPTO_THEME.text, fontSize: 11, fontWeight: '800' }}>⛶ Fullscreen</Text>
    </Pressable>
  );
}

function LoadingShim() {
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: CRYPTO_THEME.bg,
        pointerEvents: 'none',
      }}>
      <Text style={{ color: CRYPTO_THEME.textMuted, fontSize: 12, fontWeight: '600' }}>
        Loading chart…
      </Text>
    </View>
  );
}
