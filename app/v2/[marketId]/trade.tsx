import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import React from 'react';
import { TradeScreen } from '@/src/components/markets/TradeScreen';
import { getMarket } from '@/src/constants/markets';

export default function V2TradeRoute() {
  const { marketId, symbol } = useLocalSearchParams<{ marketId: string; symbol?: string }>();
  const market = getMarket(marketId);
  if (!market) return <Redirect href={'/v2' as Href} />;
  const raw = symbol ? decodeURIComponent(symbol) : '';
  const extras = market.yahooPollExtras ?? [];
  const ticker =
    raw && (market.pairs.includes(raw) || extras.includes(raw))
      ? raw
      : market.pairs[0];
  return <TradeScreen market={market} ticker={ticker} />;
}
