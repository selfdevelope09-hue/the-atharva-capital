import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScreenErrorBoundary } from '@/src/components/ScreenErrorBoundary';
import { ChatWindowScreen } from '@/src/screens/ChatWindowScreen';

export default function ChatWindowPage() {
  const { conversationId, otherUid } = useLocalSearchParams<{ conversationId: string; otherUid?: string }>();
  return (
    <ScreenErrorBoundary>
      <Stack.Screen options={{ headerShown: false }} />
      <ChatWindowScreen conversationId={conversationId ?? ''} otherUid={otherUid} />
    </ScreenErrorBoundary>
  );
}
