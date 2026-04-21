import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScreenErrorBoundary } from '@/src/components/ScreenErrorBoundary';
import { ProfileScreen } from '@/src/screens/ProfileScreen';

export default function ProfilePage() {
  const { userId, edit } = useLocalSearchParams<{ userId: string; edit?: string }>();
  const initialEdit = edit === '1' || edit === 'true';
  return (
    <ScreenErrorBoundary>
      <Stack.Screen options={{ title: 'Profile', headerShown: true, headerStyle: { backgroundColor: '#0a0a0a' }, headerTintColor: '#fff' }} />
      <ProfileScreen userId={userId ?? ''} initialEdit={initialEdit} />
    </ScreenErrorBoundary>
  );
}
