import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

import { usePriceContext, type PriceTick } from '@/contexts/PriceContext';
import {
  CRYPTO_THEME,
  displayBase,
  formatPct,
  formatPrice,
} from '@/components/crypto/cryptoTheme';

/**
 * Infinite-loop scrolling ticker bar. Two duplicate rows animate in sync so the
 * content wraps seamlessly regardless of content width.
 *
 * Uses `Animated.loop` on native; on web (via react-native-web) the transform
 * is handled through the same animation pipeline.
 */

const DEFAULT_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'AVAXUSDT',
  'LINKUSDT',
  'TONUSDT',
  'DOTUSDT',
  'MATICUSDT',
  'LTCUSDT',
  'TRXUSDT',
  'ATOMUSDT',
];

type ItemProps = { tick: PriceTick | undefined; symbol: string };

function TickerItem({ tick, symbol }: ItemProps) {
  const base = displayBase(symbol);
  const price = tick?.price;
  const pct = tick?.changePct24h;
  const up = (pct ?? 0) >= 0;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        borderRightWidth: 1,
        borderRightColor: CRYPTO_THEME.border,
        height: '100%',
      }}>
      <Text
        style={{
          color: CRYPTO_THEME.text,
          fontSize: 12,
          fontWeight: '700',
          marginRight: 8,
        }}>
        {base}
      </Text>
      <Text
        style={{
          color: CRYPTO_THEME.text,
          fontSize: 12,
          fontWeight: '600',
          fontVariant: ['tabular-nums'],
          marginRight: 6,
        }}>
        {price != null ? formatPrice(price) : '—'}
      </Text>
      <Text
        style={{
          color: up ? CRYPTO_THEME.up : CRYPTO_THEME.down,
          fontSize: 11,
          fontWeight: '700',
          fontVariant: ['tabular-nums'],
        }}>
        {pct != null ? formatPct(pct) : ''}
      </Text>
    </View>
  );
}

export function CryptoTickerBar({ symbols = DEFAULT_SYMBOLS }: { symbols?: string[] }) {
  const { prices, status } = usePriceContext();
  const translate = useRef(new Animated.Value(0)).current;
  const rowWidth = useRef<number>(0);

  const items = useMemo(() => symbols.map((s) => ({ symbol: s, tick: prices[s] })), [
    symbols,
    prices,
  ]);

  useEffect(() => {
    let mounted = true;
    function start() {
      if (!mounted) return;
      const w = rowWidth.current;
      if (w <= 0) {
        setTimeout(start, 120);
        return;
      }
      translate.setValue(0);
      Animated.loop(
        Animated.timing(translate, {
          toValue: -w,
          duration: Math.max(12000, w * 18),
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    }
    start();
    return () => {
      mounted = false;
      translate.stopAnimation();
    };
  }, [translate, items.length]);

  const dotStyle = useMemo(
    () => ({
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: status === 'open' ? CRYPTO_THEME.up : CRYPTO_THEME.down,
      marginRight: 8,
    }),
    [status]
  );

  return (
    <View
      style={{
        height: 36,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CRYPTO_THEME.surface,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: CRYPTO_THEME.border,
        overflow: 'hidden',
      }}>
      <View
        style={{
          paddingHorizontal: 12,
          height: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          borderRightWidth: 1,
          borderRightColor: CRYPTO_THEME.border,
          backgroundColor: CRYPTO_THEME.surface,
          zIndex: 2,
        }}>
        <LiveDot dotStyle={dotStyle} />
        <Text
          style={{
            color: CRYPTO_THEME.accent,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 1,
          }}>
          LIVE
        </Text>
      </View>
      <View style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
        <Animated.View
          style={{
            flexDirection: 'row',
            height: '100%',
            transform: [{ translateX: translate }],
          }}>
          <View
            onLayout={(e) => {
              rowWidth.current = e.nativeEvent.layout.width;
            }}
            style={{ flexDirection: 'row', height: '100%' }}>
            {items.map((it) => (
              <TickerItem key={`a-${it.symbol}`} tick={it.tick} symbol={it.symbol} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', height: '100%' }}>
            {items.map((it) => (
              <TickerItem key={`b-${it.symbol}`} tick={it.tick} symbol={it.symbol} />
            ))}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

function LiveDot({ dotStyle }: { dotStyle: { backgroundColor: string } & object }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[dotStyle, { opacity: pulse }]} />;
}
