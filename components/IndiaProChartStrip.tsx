import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { FullScreenTerminal } from '@/components/FullScreenTerminal';
import { UniversalChart, type UniversalChartBar } from '@/components/UniversalChart';
import { useMarketStore } from '@/store/marketStore';

function buildIndiaDemoBars(barCount: number): UniversalChartBar[] {
  const out: UniversalChartBar[] = [];
  const day = 86_400;
  let t = Math.floor(Date.now() / 1000) - barCount * day;
  let c = 2850 + (barCount % 40);
  for (let i = 0; i < barCount; i++) {
    const o = c;
    const d = (Math.sin(i / 5) + ((i % 7) - 3) * 0.04) * 42;
    const h = Math.max(o, c) + Math.abs(d) * 0.12 + 6;
    const l = Math.min(o, c) - Math.abs(d) * 0.12 - 6;
    c = Math.max(200, o + d);
    out.push({ time: t, open: o, high: h, low: l, close: c });
    t += day;
  }
  return out;
}

/** Compact NSE-style chart strip with fullscreen + India order rail (pro terminal). */
export function IndiaProChartStrip() {
  const [symbol, setSymbol] = useState('RELIANCE');
  const setChartTicker = useMarketStore((s) => s.setChartTicker);
  const chartData = useMemo(() => buildIndiaDemoBars(130), []);

  useEffect(() => {
    setChartTicker(symbol);
  }, [symbol, setChartTicker]);

  return (
    <View className="border-b border-neutral-800 bg-[#0a0a0a] px-2 py-2">
      <Text className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
        Pro chart · {symbol}
      </Text>
      <FullScreenTerminal symbol={symbol} activeMarket="INDIA" onSymbolChange={setSymbol} embedMinHeight={200}>
        {(slot) => (
          <UniversalChart
            data={chartData}
            colorTheme="dark"
            market="INDIA"
            symbol={symbol}
            minHeight={slot.minHeight}
            showFullscreenButton={slot.showFullscreenButton}
            onFullscreenPress={slot.onFullscreenPress}
          />
        )}
      </FullScreenTerminal>
    </View>
  );
}
