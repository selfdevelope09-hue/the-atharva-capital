import { Stack } from 'expo-router';
import React from 'react';
import { ScreenErrorBoundary } from '@/src/components/ScreenErrorBoundary';
import { ChatListScreen } from '@/src/screens/ChatListScreen';

export default function ChatsPage() {
  return (
    <ScreenErrorBoundary>
      <Stack.Screen options={{ title: 'Messages', headerShown: true, headerStyle: { backgroundColor: '#0a0a0a' }, headerTintColor: '#fff' }} />
      <ChatListScreen />
    </ScreenErrorBoundary>
  );
}
