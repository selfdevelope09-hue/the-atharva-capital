import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  CRYPTO_THEME,
  displayBase,
  formatCompactUsd,
  formatPct,
  formatPrice,
} from '@/components/crypto/cryptoTheme';
import type { PriceTick } from '@/contexts/PriceContext';

export type MarketCardProps = {
  tick: PriceTick;
  onTradePress: (symbol: string) => void;
};

/**
 * Coin card with live price, 24h % badge, quote volume and a "Trade →" CTA.
 * Hover / press raises the card by 2 px and lights up the border — the RN
 * equivalent of the web `:hover { translateY(-2px); border-color: accent }`.
 */
export function MarketCard({ tick, onTradePress }: MarketCardProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const up = tick.changePct24h >= 0;
  const active = hovered || pressed;

  return (
    <Pressable
      onPress={() => onTradePress(tick.symbol)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        minWidth: 220,
        flexGrow: 1,
        flexBasis: 240,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: active ? CRYPTO_THEME.accent : CRYPTO_THEME.border,
        backgroundColor: CRYPTO_THEME.surface,
        transform: [{ translateY: active ? -2 : 0 }],
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text
            style={{
              color: CRYPTO_THEME.text,
              fontSize: 16,
              fontWeight: '800',
              letterSpacing: 0.3,
            }}>
            {displayBase(tick.symbol)}
          </Text>
          <Text
            style={{
              color: CRYPTO_THEME.textMuted,
              fontSize: 11,
              marginLeft: 6,
              fontWeight: '600',
            }}>
            /USDT
          </Text>
        </View>
        <ChangeBadge up={up} pct={tick.changePct24h} />
      </View>

      <Text
        style={{
          marginTop: 10,
          color: CRYPTO_THEME.text,
          fontSize: 22,
          fontWeight: '800',
          fontVariant: ['tabular-nums'],
        }}>
        ${formatPrice(tick.price)}
      </Text>

      <View style={{ flexDirection: 'row', marginTop: 10, gap: 12 }}>
        <StatBlock label="24h High" value={`$${formatPrice(tick.high24h)}`} />
        <StatBlock label="24h Low" value={`$${formatPrice(tick.low24h)}`} />
      </View>

      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        <StatBlock label="Vol (USDT)" value={formatCompactUsd(tick.quoteVolume)} />
      </View>

      <View
        style={{
          marginTop: 12,
          height: 36,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: active ? CRYPTO_THEME.accent : CRYPTO_THEME.borderStrong,
          backgroundColor: active ? CRYPTO_THEME.accentSoft : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text style={{ color: CRYPTO_THEME.accent, fontSize: 12, fontWeight: '800' }}>
          Trade →
        </Text>
      </View>
    </Pressable>
  );
}

function ChangeBadge({ up, pct }: { up: boolean; pct: number }) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: up ? CRYPTO_THEME.upSoft : CRYPTO_THEME.downSoft,
      }}>
      <Text
        style={{
          color: up ? CRYPTO_THEME.up : CRYPTO_THEME.down,
          fontSize: 11,
          fontWeight: '800',
          fontVariant: ['tabular-nums'],
        }}>
        {formatPct(pct)}
      </Text>
    </View>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          color: CRYPTO_THEME.textMuted,
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}>
        {label}
      </Text>
      <Text
        style={{
          color: CRYPTO_THEME.text,
          fontSize: 12,
          fontWeight: '600',
          marginTop: 2,
          fontVariant: ['tabular-nums'],
        }}>
        {value}
      </Text>
    </View>
  );
}
