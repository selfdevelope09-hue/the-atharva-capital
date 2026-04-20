import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { T } from '@/src/constants/theme';
import { useNotificationStore } from '@/store/notificationStore';

export function InAppToastHost() {
  const toasts = useNotificationStore((s) => s.toasts);
  const dismiss = useNotificationStore((s) => s.dismiss);
  if (toasts.length === 0) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 12, right: 12, bottom: 24, zIndex: 9999, gap: 8 }}
    >
      {toasts.slice(-4).map((t) => (
        <Pressable
          key={t.id}
          onPress={() => dismiss(t.id)}
          style={{
            backgroundColor: T.bg1,
            borderWidth: 1,
            borderColor: T.borderBright,
            borderRadius: T.radiusMd,
            padding: 12,
          }}
        >
          <Text style={{ color: T.text0, fontSize: 13, fontWeight: '600' }}>{t.message}</Text>
        </Pressable>
      ))}
    </View>
  );
}
