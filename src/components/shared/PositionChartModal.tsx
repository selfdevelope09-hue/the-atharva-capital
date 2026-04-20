import React, { useMemo, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { MarketConfig } from '@/src/constants/markets';
import { T } from '@/src/constants/theme';
import { ChartWithOverlay, type TpSl } from './ChartWithOverlay';

export interface PositionChartModalProps {
  visible: boolean;
  onClose: () => void;
  market: MarketConfig;
  tvSymbol: string;
  entryPrice: number;
  tp: number | null;
  sl: number | null;
  side: 'long' | 'short';
  timezone?: string;
  onChangeTp?: (p: number) => void;
  onChangeSl?: (p: number) => void;
}

export function PositionChartModal({
  visible,
  onClose,
  market,
  tvSymbol,
  entryPrice,
  tp,
  sl,
  side,
  timezone,
  onChangeTp,
  onChangeSl,
}: PositionChartModalProps) {
  const [h, setH] = useState(420);
  const w = Dimensions.get('window').width;

  const tpsl: TpSl = useMemo(
    () => ({ entry: entryPrice, tp, sl, side }),
    [entryPrice, tp, sl, side]
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: T.bg0,
            borderTopLeftRadius: T.radiusXl,
            borderTopRightRadius: T.radiusXl,
            borderWidth: 1,
            borderColor: T.border,
            maxHeight: '92%',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
            <Text style={{ color: T.text0, fontSize: 16, fontWeight: '800' }}>{market.flag} Position chart</Text>
            <Pressable onPress={onClose} style={{ padding: 8 }}>
              <Text style={{ color: T.text2, fontSize: 22 }}>×</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }} onLayout={(e) => setH(Math.min(560, Math.max(360, e.nativeEvent.layout.height - 80)))}>
            <View style={{ paddingHorizontal: 12 }}>
              <ChartWithOverlay
                tvSymbol={tvSymbol}
                tpsl={tpsl}
                accentColor={market.accentColor ?? T.yellow}
                timezone={timezone ?? market.timezone ?? 'Etc/UTC'}
                height={h}
                onChangeTp={onChangeTp}
                onChangeSl={onChangeSl}
              />
            </View>
            <Text style={{ color: T.text3, fontSize: 11, paddingHorizontal: 16, paddingTop: 8 }}>
              Drag TP/SL on chart when enabled — same overlay math as live trade screen.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
