import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Modal, Pressable, Text, View } from 'react-native';

import type { WatchlistRow } from '@/components/Watchlist';

type TradeActionModalProps = {
  visible: boolean;
  instrument: WatchlistRow | null;
  onClose: () => void;
};

export function TradeActionModal({ visible, instrument, onClose }: TradeActionModalProps) {
  if (!instrument) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="flex-1 bg-black/65" onPress={onClose} accessibilityRole="button" />

        <View className="rounded-t-3xl border border-neutral-800 border-b-0 bg-[#0f0f0f] px-4 pb-8 pt-3">
          <View className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-700" />

          <View className="flex-row items-start justify-between">
            <View className="min-w-0 flex-1 pr-3">
              <Text className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Virtual order pad
              </Text>
              <Text className="mt-1 text-xl font-bold text-neutral-100">{instrument.symbol}</Text>
              <Text className="mt-0.5 text-xs text-neutral-500" numberOfLines={2}>
                {instrument.name}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              className="h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel="Close">
              <FontAwesome name="close" size={18} color="#d4d4d4" />
            </Pressable>
          </View>

          <View className="mt-4 flex-row gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-3">
            <View className="flex-1">
              <Text className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">LTP</Text>
              <Text className="mt-1 text-base font-bold tabular-nums text-neutral-100">
                {instrument.ltp.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            </View>
            <View className="flex-1 items-end">
              <Text className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Chg%</Text>
              <Text
                className={`mt-1 text-base font-bold tabular-nums ${
                  instrument.changePct >= 0 ? 'text-[#00b050]' : 'text-[#ff3b30]'
                }`}>
                {instrument.changePct >= 0 ? '+' : ''}
                {instrument.changePct.toFixed(2)}%
              </Text>
            </View>
          </View>

          <View className="mt-5 flex-row gap-3">
            <Pressable className="flex-1 items-center justify-center rounded-xl bg-[#00b050] py-3.5 active:opacity-90">
              <Text className="text-sm font-extrabold text-black">BUY</Text>
              <Text className="mt-0.5 text-[10px] font-semibold text-black/70">Paper trade</Text>
            </Pressable>
            <Pressable className="flex-1 items-center justify-center rounded-xl bg-[#ff3b30] py-3.5 active:opacity-90">
              <Text className="text-sm font-extrabold text-white">SELL</Text>
              <Text className="mt-0.5 text-[10px] font-semibold text-white/80">Paper trade</Text>
            </Pressable>
          </View>

          <Text className="mt-4 text-center text-[11px] leading-4 text-neutral-600">
            Execution is simulated. Next phase wires Dhan + order routing.
          </Text>
        </View>
      </View>
    </Modal>
  );
}
