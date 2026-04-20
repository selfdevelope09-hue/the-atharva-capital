import { Stack } from 'expo-router';
import React from 'react';

/** Pricing comes from root `UnifiedMarketsPriceProvider` — no nested socket here. */
export default function V2Layout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0a0a' } }} />;
}
