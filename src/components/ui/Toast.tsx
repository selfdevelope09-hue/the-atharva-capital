import React, { useState, useCallback } from 'react';
import { Animated, Platform, Text, View } from 'react-native';
import { T } from '../../constants/theme';

export type ToastType = 'green' | 'red' | 'yellow' | 'gray';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

const TYPE_COLOR: Record<ToastType, string> = {
  green: T.green,
  red: T.red,
  yellow: T.yellow,
  gray: T.text2,
};

const TYPE_BG: Record<ToastType, string> = {
  green: T.greenDim,
  red: T.redDim,
  yellow: 'rgba(240,185,11,0.12)',
  gray: T.bg2,
};

const TYPE_BORDER: Record<ToastType, string> = {
  green: T.green,
  red: T.red,
  yellow: T.yellow,
  gray: T.border,
};

function ToastBubble({ toast }: { toast: ToastItem }) {
  const color = TYPE_COLOR[toast.type];
  const bg = TYPE_BG[toast.type];
  const border = TYPE_BORDER[toast.type];

  return (
    <View
      style={{
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        maxWidth: 320,
        shadowColor: color,
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 6,
      }}
    >
      <Text style={{ color, fontSize: 13, fontWeight: '700' }}>{toast.message}</Text>
    </View>
  );
}

export function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null;

  const isWeb = Platform.OS === 'web';

  return (
    <View
      pointerEvents="none"
      style={
        isWeb
          ? {
              position: 'absolute' as const,
              top: 20,
              right: 16,
              zIndex: 9999,
              gap: 8,
              alignItems: 'flex-end',
            }
          : {
              position: 'absolute' as const,
              top: 60,
              right: 16,
              zIndex: 9999,
              gap: 8,
              alignItems: 'flex-end',
            }
      }
    >
      {toasts.map((t) => (
        <ToastBubble key={t.id} toast={t} />
      ))}
    </View>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, type: ToastType = 'green', duration = 3000) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  return { toasts, show };
}
