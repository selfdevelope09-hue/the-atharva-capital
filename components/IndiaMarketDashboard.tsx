import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { IndiaProChartStrip } from '@/components/IndiaProChartStrip';
import { MainTradingArea } from '@/components/MainTradingArea';
import { TradeActionModal } from '@/components/TradeActionModal';
import { Watchlist, type WatchlistRow } from '@/components/Watchlist';
import { useWatchlistListsStore } from '@/store/watchlistListsStore';

export type IndiaMarketDashboardProps = {
  isWide: boolean;
  watchlistOpen: boolean;
  onWatchlistOpenChange: (open: boolean) => void;
};

export function IndiaMarketDashboard({
  isWide,
  watchlistOpen,
  onWatchlistOpenChange,
}: IndiaMarketDashboardProps) {
  const [tradeInstrument, setTradeInstrument] = useState<WatchlistRow | null>(null);
  const [tradeOpen, setTradeOpen] = useState(false);
  const refreshWatchlists = useWatchlistListsStore((s) => s.refresh);

  useEffect(() => {
    void refreshWatchlists();
  }, [refreshWatchlists]);

  const openTrade = useCallback(
    (row: WatchlistRow) => {
      setTradeInstrument(row);
      setTradeOpen(true);
      if (!isWide) onWatchlistOpenChange(false);
    },
    [isWide, onWatchlistOpenChange]
  );

  return (
    <>
      <View className="flex-1 flex-row">
        {isWide ? (
          <View className="w-[280px] border-r" style={{ borderColor: '#1A1A1A' }}>
            <Watchlist title="Market watch" onSelect={openTrade} />
          </View>
        ) : null}

        <View className="min-w-0 flex-1">
          <IndiaProChartStrip />
          <View className="min-h-0 flex-1">
            <MainTradingArea />
          </View>
        </View>
      </View>

      <Modal
        visible={watchlistOpen}
        animationType="slide"
        transparent
        onRequestClose={() => onWatchlistOpenChange(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <Pressable className="flex-1" onPress={() => onWatchlistOpenChange(false)} accessibilityRole="button" />
          <View className="max-h-[78%] rounded-t-3xl border border-b-0 border-[#1A1A1A] bg-black">
            <View className="items-center py-2">
              <View className="h-1 w-10 rounded-full bg-neutral-700" />
            </View>
            <View className="flex-row items-center justify-between px-4 pb-2">
              <Text className="text-sm font-extrabold text-neutral-100">Watchlist</Text>
              <Pressable onPress={() => onWatchlistOpenChange(false)} hitSlop={10}>
                <Text className="text-sm font-bold text-neutral-400">Close</Text>
              </Pressable>
            </View>
            <View className="h-[520px]">
              <Watchlist title="Market watch" onSelect={openTrade} />
            </View>
          </View>
        </View>
      </Modal>

      <TradeActionModal
        visible={tradeOpen}
        instrument={tradeInstrument}
        onClose={() => {
          setTradeOpen(false);
          setTradeInstrument(null);
        }}
      />
    </>
  );
}
