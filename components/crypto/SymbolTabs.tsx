import { Pressable, ScrollView, Text, View } from 'react-native';

import { CRYPTO_THEME, displayBase } from '@/components/crypto/cryptoTheme';

export type SymbolTabsProps = {
  symbols: string[];
  active: string;
  onChange: (symbol: string) => void;
};

/** Horizontally scrollable symbol tabs (BTC, ETH, SOL, BNB, XRP, DOGE …). */
export function SymbolTabs({ symbols, active, onChange }: SymbolTabsProps) {
  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: CRYPTO_THEME.border,
        backgroundColor: CRYPTO_THEME.bg,
      }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 6, gap: 6 }}>
        {symbols.map((s) => {
          const isActive = s === active;
          return (
            <Pressable
              key={s}
              onPress={() => onChange(s)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: isActive ? CRYPTO_THEME.accent : CRYPTO_THEME.border,
                backgroundColor: isActive ? CRYPTO_THEME.accentSoft : CRYPTO_THEME.surface,
              }}>
              <Text
                style={{
                  color: isActive ? CRYPTO_THEME.accent : CRYPTO_THEME.text,
                  fontSize: 12,
                  fontWeight: '800',
                  letterSpacing: 0.4,
                }}>
                {displayBase(s)}
                <Text style={{ color: CRYPTO_THEME.textMuted, fontWeight: '600' }}>/USDT</Text>
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
