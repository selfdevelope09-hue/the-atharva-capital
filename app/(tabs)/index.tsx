import { Text, View } from 'react-native';

import { useAppStore } from '@/store';

export default function TabOneScreen() {
  const activeMarket = useAppStore((s) => s.activeMarket);

  return (
    <View className="flex-1 items-center justify-center bg-neutral-950 px-6">
      <Text className="text-center text-2xl font-bold text-emerald-400">The Atharva Capital</Text>
      <Text className="mt-2 text-center text-sm text-neutral-400">
        Virtual Trading Universe · Foundation
      </Text>
      <Text className="mt-6 rounded-lg border border-emerald-500/30 bg-neutral-900 px-4 py-2 text-xs text-neutral-300">
        Active market (store): {activeMarket}
      </Text>
    </View>
  );
}
