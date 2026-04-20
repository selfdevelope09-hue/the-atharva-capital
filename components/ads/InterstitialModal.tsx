import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { T } from '@/src/constants/theme';
import { useInterstitialUiStore } from '@/store/interstitialUiStore';

export function InterstitialModal() {
  const visible = useInterstitialUiStore((s) => s.visible);
  const headline = useInterstitialUiStore((s) => s.headline);
  const body = useInterstitialUiStore((s) => s.body);
  const networkLabel = useInterstitialUiStore((s) => s.networkLabel);
  const hide = useInterstitialUiStore((s) => s.hide);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={hide}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', padding: 24 }} onPress={hide}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: T.bg1, borderRadius: T.radiusLg, padding: 22, borderWidth: 1, borderColor: T.border }}>
          <Text style={{ color: '#7b8390', fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>SPONSORED · {networkLabel}</Text>
          <Text style={{ color: T.text0, fontSize: 20, fontWeight: '800', marginTop: 10 }}>{headline}</Text>
          <Text style={{ color: T.text2, fontSize: 14, marginTop: 10, lineHeight: 20 }}>{body}</Text>
          <Pressable onPress={hide} style={{ marginTop: 20, backgroundColor: T.yellow, padding: 14, borderRadius: T.radiusMd, alignItems: 'center' }}>
            <Text style={{ color: '#000', fontWeight: '800' }}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
