import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { CRYPTO_THEME } from '@/components/crypto/cryptoTheme';

export type CryptoChartFrameProps = {
  symbol: string;
  interval?: string;
  theme?: 'dark' | 'light';
  showFullscreen?: boolean;
  onFullscreen?: () => void;
};

/**
 * TradingView lightweight widget-embed iframe (web) / WebView (native).
 *
 * Per spec URL template:
 *   https://s.tradingview.com/widgetembed/?symbol=BINANCE%3A{SYMBOL}&interval=15&theme=dark
 */
export function CryptoChartFrame({
  symbol,
  interval = '15',
  theme = 'dark',
  showFullscreen = false,
  onFullscreen,
}: CryptoChartFrameProps) {
  const src = useMemo(() => buildWidgetUrl(symbol, interval, theme), [
    symbol,
    interval,
    theme,
  ]);

  if (Platform.OS === 'web') {
    return <WebIframe src={src} showFullscreen={showFullscreen} onFullscreen={onFullscreen} />;
  }
  return <NativeWebView src={src} showFullscreen={showFullscreen} onFullscreen={onFullscreen} />;
}

function buildWidgetUrl(symbol: string, interval: string, theme: 'dark' | 'light'): string {
  const s = encodeURIComponent(`BINANCE:${symbol.toUpperCase()}`);
  const params = [
    `symbol=${s}`,
    `interval=${encodeURIComponent(interval)}`,
    `theme=${theme}`,
    `style=1`,
    `timezone=Etc%2FUTC`,
    `hide_side_toolbar=0`,
    `hide_top_toolbar=0`,
    `withdateranges=1`,
    `save_image=0`,
    `studies=%5B%22RSI%40tv-basicstudies%22%2C%22MACD%40tv-basicstudies%22%5D`,
  ].join('&');
  return `https://s.tradingview.com/widgetembed/?${params}`;
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

/* -------- Web ----------------------------------------------------------- */

function WebIframe({
  src,
  showFullscreen,
  onFullscreen,
}: {
  src: string;
  showFullscreen: boolean;
  onFullscreen?: () => void;
}) {
  const hostRef = useRef<View | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host) return;

    host.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.style.background = CRYPTO_THEME.bg;
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute(
      'allow',
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
    );
    iframe.onload = () => setReady(true);
    host.appendChild(iframe);

    return () => {
      host.innerHTML = '';
    };
  }, [src]);

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

/* -------- Native -------------------------------------------------------- */

function NativeWebView({
  src,
  showFullscreen,
  onFullscreen,
}: {
  src: string;
  showFullscreen: boolean;
  onFullscreen?: () => void;
}) {
  return (
    <View
      style={{ flex: 1, minHeight: 320, width: '100%', backgroundColor: CRYPTO_THEME.bg }}
      collapsable={false}>
      <WebView
        source={{ uri: src }}
        javaScriptEnabled
        domStorageEnabled
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
