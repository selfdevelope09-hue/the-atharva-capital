import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import React from 'react';

import AustraliaMarketScreen from '@/src/screens/markets/AustraliaMarketScreen';
import CanadaMarketScreen from '@/src/screens/markets/CanadaMarketScreen';
import ChinaMarketScreen from '@/src/screens/markets/ChinaMarketScreen';
import CryptoMarketScreen from '@/src/screens/markets/CryptoMarketScreen';
import GermanyMarketScreen from '@/src/screens/markets/GermanyMarketScreen';
import IndiaMarketScreen from '@/src/screens/markets/IndiaMarketScreen';
import JapanMarketScreen from '@/src/screens/markets/JapanMarketScreen';
import SwitzerlandMarketScreen from '@/src/screens/markets/SwitzerlandMarketScreen';
import UKMarketScreen from '@/src/screens/markets/UKMarketScreen';
import USAMarketScreen from '@/src/screens/markets/USAMarketScreen';
import type { MarketId } from '@/src/constants/markets';

const SCREENS: Record<MarketId, React.ComponentType> = {
  crypto: CryptoMarketScreen,
  india: IndiaMarketScreen,
  usa: USAMarketScreen,
  uk: UKMarketScreen,
  china: ChinaMarketScreen,
  japan: JapanMarketScreen,
  australia: AustraliaMarketScreen,
  germany: GermanyMarketScreen,
  canada: CanadaMarketScreen,
  switzerland: SwitzerlandMarketScreen,
};

export default function V2MarketRoute() {
  const { marketId } = useLocalSearchParams<{ marketId: string }>();
  const Screen = marketId && marketId in SCREENS ? SCREENS[marketId as MarketId] : null;
  if (!Screen) return <Redirect href={'/v2' as Href} />;
  return <Screen />;
}
