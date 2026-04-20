import { Pressable, ScrollView, Text, View } from 'react-native';

import { type ActiveMarket, useMarketStore } from '@/store/marketStore';
import { useThemeStore } from '@/store/themeStore';

const OPTIONS: { id: ActiveMarket; label: string; emoji: string }[] = [
  { id: 'INDIA', label: 'Indian Market', emoji: '🇮🇳' },
  { id: 'US', label: 'US Market', emoji: '🇺🇸' },
  { id: 'CHINA', label: 'Chinese Market', emoji: '🇨🇳' },
  { id: 'JAPAN', label: 'Japanese Market', emoji: '🇯🇵' },
  { id: 'UK', label: 'UK Market', emoji: '🇬🇧' },
  { id: 'AUSTRALIA', label: 'Aus Market', emoji: '🇦🇺' },
  { id: 'GERMANY', label: 'German Market', emoji: '🇩🇪' },
  { id: 'CANADA', label: 'Canadian Market', emoji: '🇨🇦' },
  { id: 'SWITZERLAND', label: 'Swiss Market', emoji: '🇨🇭' },
  { id: 'CRYPTO', label: 'Crypto', emoji: '🪙' },
];

export function MarketSwitcher() {
  const palette = useThemeStore((s) => s.palette);
  const activeMarket = useMarketStore((s) => s.activeMarket);
  const setActiveMarket = useMarketStore((s) => s.setActiveMarket);

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.bg, paddingHorizontal: 8, paddingVertical: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
        {OPTIONS.map((opt) => {
          const on = activeMarket === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => setActiveMarket(opt.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              className="flex-row items-center rounded-full border px-3.5 py-2"
              style={{
                borderColor: on ? palette.accent : palette.border,
                backgroundColor: on ? `${palette.accent}22` : palette.surface,
              }}>
              <Text className="text-base">{opt.emoji}</Text>
              <Text className="ml-2 text-xs font-bold" style={{ color: on ? palette.text : palette.textMuted }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
