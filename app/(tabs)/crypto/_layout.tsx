import { Stack } from 'expo-router';

export default function CryptoLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0b0e11' },
        animation: 'fade',
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[symbol]" />
    </Stack>
  );
}
