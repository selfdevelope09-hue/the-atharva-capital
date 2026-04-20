import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Pressable, Text, View } from 'react-native';

import { useProfileStore } from '@/store/profileStore';
import { useThemeStore } from '@/store/themeStore';
import { useUiStore } from '@/store/uiStore';

export function DashboardIdentityHeader() {
  const palette = useThemeStore((s) => s.palette);
  const clientId = useProfileStore((s) => s.clientId);
  const totalUsd = useProfileStore((s) => s.totalNetWorthUsd);
  const openSettings = useUiStore((s) => s.openSettings);

  const cid = clientId ?? 'ATC-pending…';
  const usdLabel = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(totalUsd);

  return (
    <View
      className="flex-row items-center justify-between border-b px-3 py-3"
      style={{ borderColor: palette.border, backgroundColor: palette.surface2 }}>
      <View className="min-w-0 flex-1 pr-3">
        <Text className="text-[10px] font-bold uppercase tracking-widest" style={{ color: palette.textMuted }}>
          Universal client ID
        </Text>
        <Text className="mt-0.5 text-base font-black" style={{ color: palette.text }} numberOfLines={1}>
          {cid}
        </Text>
        <Text className="mt-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: palette.textMuted }}>
          Global earnings (USD)
        </Text>
        <Text className="text-lg font-black tabular-nums" style={{ color: palette.accent }}>
          {usdLabel}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings and account"
        onPress={openSettings}
        className="h-11 w-11 items-center justify-center rounded-full border active:opacity-80"
        style={{ borderColor: palette.border, backgroundColor: palette.surface }}>
        <FontAwesome name="cog" size={22} color={palette.text} />
      </Pressable>
    </View>
  );
}
