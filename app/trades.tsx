import { Stack } from 'expo-router';
import React from 'react';
import { ScreenErrorBoundary } from '@/src/components/ScreenErrorBoundary';
import { TradeHistoryScreen } from '@/src/screens/TradeHistoryScreen';

export default function TradesPage() {
  return (
    <ScreenErrorBoundary>
      <Stack.Screen
        options={{
          title: 'Trade History',
          headerShown: true,
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#fff',
        }}
      />
      <TradeHistoryScreen />
    </ScreenErrorBoundary>
  );
}
