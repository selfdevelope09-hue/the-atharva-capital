import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScreenErrorBoundary } from '@/src/components/ScreenErrorBoundary';
import { TopUpScreen } from '@/src/screens/TopUpScreen';

export default function TopUpPage() {
  const { market } = useLocalSearchParams<{ market: string }>();
  return (
    <ScreenErrorBoundary>
      <Stack.Screen options={{ title: 'Top Up', headerShown: true, headerStyle: { backgroundColor: '#0a0a0a' }, headerTintColor: '#fff' }} />
      <TopUpScreen market={market ?? 'crypto'} />
    </ScreenErrorBoundary>
  );
}
