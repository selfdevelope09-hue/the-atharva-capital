import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, PanResponder, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdaptiveOrderSidebar } from '@/components/AdaptiveOrderSidebar';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import type { ActiveMarket } from '@/store/marketStore';

export type FullScreenChartSlotProps = {
  isFullscreen: boolean;
  minHeight: number;
  showFullscreenButton: boolean;
  onFullscreenPress: () => void;
};

export type FullScreenTerminalProps = {
  symbol: string;
  activeMarket: ActiveMarket;
  onSymbolChange?: (symbol: string) => void;
  /** Embedded chart min height when not in fullscreen. */
  embedMinHeight?: number;
  children: (slot: FullScreenChartSlotProps) => ReactNode;
};

/**
 * Pro desktop: expand chart to a full-screen modal with a collapsible order rail.
 * On narrow viewports the order UI becomes a **bottom sheet** (drag handle to dismiss).
 */
export function FullScreenTerminal({
  symbol,
  activeMarket,
  onSymbolChange,
  embedMinHeight = 280,
  children,
}: FullScreenTerminalProps) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const { isOrderBottomSheet } = useBreakpoint();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOrderSidebarOpen, setIsOrderSidebarOpen] = useState(true);
  const dragDy = useRef(0);

  const openFullscreen = useCallback(() => {
    setIsFullscreen(true);
    setIsOrderSidebarOpen(true);
  }, []);

  const closeFullscreen = useCallback(() => {
    setIsFullscreen(false);
  }, []);

  const closeOrderOnly = useCallback(() => {
    setIsOrderSidebarOpen(false);
  }, []);

  const sheetPan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 4,
        onPanResponderMove: (_, g) => {
          dragDy.current = g.dy;
        },
        onPanResponderRelease: () => {
          if (dragDy.current > 56) closeOrderOnly();
          dragDy.current = 0;
        },
      }),
    [closeOrderOnly]
  );

  const fsMinH = Math.max(200, winH - insets.top - insets.bottom - 8);
  const sheetMaxH = Math.min(winH * 0.9, winH - insets.top - 24);

  const orderRail = isOrderSidebarOpen && !isOrderBottomSheet && (
    <AdaptiveOrderSidebar
      layout="rail"
      symbol={symbol}
      activeMarket={activeMarket}
      onClose={closeOrderOnly}
      onSymbolChange={onSymbolChange}
    />
  );

  const orderSheet = isFullscreen && isOrderSidebarOpen && isOrderBottomSheet && (
    <Modal transparent visible animationType="fade" onRequestClose={closeOrderOnly}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <Pressable className="flex-1" onPress={closeOrderOnly} accessibilityLabel="Dismiss order sheet" />
        <View
          style={{
            maxHeight: sheetMaxH,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            overflow: 'hidden',
            backgroundColor: '#111',
          }}>
          <View
            className="items-center border-b border-neutral-800 py-2"
            {...sheetPan.panHandlers}>
            <View className="h-1 w-10 rounded-full bg-neutral-600" />
            <Text className="mt-1 text-[10px] text-neutral-500">Drag down to close</Text>
          </View>
          <AdaptiveOrderSidebar
            layout="sheet"
            symbol={symbol}
            activeMarket={activeMarket}
            onClose={closeOrderOnly}
            onSymbolChange={onSymbolChange}
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      {children({
        isFullscreen: false,
        minHeight: embedMinHeight,
        showFullscreenButton: true,
        onFullscreenPress: openFullscreen,
      })}

      <Modal
        visible={isFullscreen}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={closeFullscreen}>
        <View
          className="flex-1 flex-row bg-[#0a0a0a]"
          style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center justify-between px-2 py-1">
              <Pressable
                onPress={closeFullscreen}
                hitSlop={12}
                className="flex-row items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900/90 px-3 py-2 active:opacity-80">
                <FontAwesome name="compress" size={16} color="#e5e5e5" />
                <Text className="text-xs font-bold text-neutral-200">Exit</Text>
              </Pressable>
              <Text className="pr-2 font-mono text-[11px] font-semibold text-neutral-500" numberOfLines={1}>
                {symbol} · fullscreen
              </Text>
            </View>
            <View className="min-h-0 flex-1">
              {children({
                isFullscreen: true,
                minHeight: fsMinH,
                showFullscreenButton: false,
                onFullscreenPress: openFullscreen,
              })}
            </View>

            {!isOrderSidebarOpen ? (
              <Pressable
                onPress={() => setIsOrderSidebarOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Open order sidebar"
                className="absolute bottom-10 right-4 z-20 rounded-full border border-amber-500/60 bg-amber-500/25 px-4 py-3 shadow-lg active:opacity-90">
                <Text className="text-xs font-black text-amber-100">Order</Text>
              </Pressable>
            ) : null}
          </View>

          {orderRail}
        </View>
        {orderSheet}
      </Modal>
    </>
  );
}
