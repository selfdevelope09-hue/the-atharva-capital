import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ChatWindowScreen } from '@/src/screens/ChatWindowScreen';

export default function ChatWindowPage() {
  const { conversationId, otherUid } = useLocalSearchParams<{ conversationId: string; otherUid?: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ChatWindowScreen conversationId={conversationId ?? ''} otherUid={otherUid} />
    </>
  );
}
