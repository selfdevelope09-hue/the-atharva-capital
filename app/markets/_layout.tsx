import { Stack } from 'expo-router';
import React from 'react';

/** Alias stack for `/markets/[marketId]` — mirrors `app/v2` terminal routes. */
export default function MarketsAliasLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0a0a' } }} />;
}
