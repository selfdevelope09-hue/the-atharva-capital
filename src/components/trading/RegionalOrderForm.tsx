import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { OrderForm, type OrderFormProps } from '@/src/components/shared/OrderForm';
import { T } from '@/src/constants/theme';
import type { TradingRegion } from '@/src/constants/marketRegionUi';
import { useMarketConfig } from '@/src/hooks/useMarketConfig';
import { OptionChainPanel } from '@/src/components/trading/OptionChainPanel';

export type RegionalOrderFormProps = OrderFormProps & {
  ticker: string;
};

function TabBar({
  value,
  onChange,
}: {
  value: 'order' | 'options';
  onChange: (v: 'order' | 'options') => void;
}) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: T.bg2, borderRadius: T.radiusMd, padding: 4, gap: 4 }}>
      {(['order', 'options'] as const).map((k) => {
        const on = value === k;
        return (
          <Pressable
            key={k}
            onPress={() => onChange(k)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: T.radiusSm,
              backgroundColor: on ? T.yellow : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: on ? '#000' : T.text1, fontWeight: '800', fontSize: 12 }}>
              {k === 'order' ? 'Order' : 'Option chain'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Region-aware order rail: localized copy, fee lines, quantity rules, and
 * India option-chain tab. Delegates execution UI to `OrderForm`.
 */
export function RegionalOrderForm(props: RegionalOrderFormProps) {
  const { ticker, market, lastPrice, ...orderRest } = props;
  const regionUi = useMarketConfig(ticker, market.id as TradingRegion);

  const [panel, setPanel] = useState<'order' | 'options'>('order');
  const [equityMode, setEquityMode] = useState(regionUi.equityModes?.[0]?.id ?? 'default');
  const [optSide, setOptSide] = useState<'ce' | 'pe'>('ce');

  useEffect(() => {
    setEquityMode(regionUi.equityModes?.[0]?.id ?? 'default');
    setPanel('order');
  }, [regionUi.region, regionUi.equityModes]);

  const showChain = Boolean(
    regionUi.derivatives?.optionChain && (regionUi.region === 'india' || regionUi.region === 'usa')
  );

  return (
    <View style={{ gap: 12 }}>
      <View style={{ paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: T.border }}>
        <Text style={{ color: T.text0, fontSize: 15, fontWeight: '900' }}>{regionUi.title}</Text>
        {regionUi.subtitle ? (
          <Text style={{ color: T.text3, fontSize: 12, marginTop: 4 }}>{regionUi.subtitle}</Text>
        ) : null}
        {regionUi.sessionHints && regionUi.sessionHints.length > 0 ? (
          <Text style={{ color: T.text2, fontSize: 11, marginTop: 6 }}>
            {regionUi.sessionHints.join(' · ')}
          </Text>
        ) : null}
        {regionUi.australia?.chessSponsored ? (
          <Text style={{ color: T.green, fontSize: 10, marginTop: 6, fontWeight: '700' }}>
            CHESS-sponsored (demo indicator)
          </Text>
        ) : null}
        {regionUi.brazil?.fractionalSuffix ? (
          <Text style={{ color: T.text3, fontSize: 10, marginTop: 4 }}>
            Fractional B3 lots often use suffix {regionUi.brazil.fractionalSuffix}
          </Text>
        ) : null}
        {regionUi.derivatives?.warrantsNote ? (
          <Text style={{ color: T.text3, fontSize: 10, marginTop: 6 }}>{regionUi.derivatives.warrantsNote}</Text>
        ) : null}
      </View>

      {showChain ? <TabBar value={panel} onChange={setPanel} /> : null}

      {panel === 'options' && showChain ? (
        <OptionChainPanel symbol={ticker} lastPrice={lastPrice} side={optSide} onToggleSide={setOptSide} />
      ) : (
        <OrderForm
          {...orderRest}
          market={market}
          lastPrice={lastPrice}
          regionUi={regionUi}
          equityMode={equityMode}
          onEquityModeChange={setEquityMode}
        />
      )}
    </View>
  );
}
