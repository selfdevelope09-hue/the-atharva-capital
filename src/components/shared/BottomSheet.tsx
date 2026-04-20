import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Modal, Pressable, View } from 'react-native';
import { T } from '../../constants/theme';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  heightPct?: number;
  children: React.ReactNode;
}

export function BottomSheet({ visible, onClose, heightPct = 0.8, children }: BottomSheetProps) {
  const translateY = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const screenH = Dimensions.get('window').height;
  const sheetH = screenH * heightPct;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: screenH - sheetH, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: screenH, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, screenH, sheetH, translateY, opacity]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', opacity }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: screenH,
          transform: [{ translateY }],
          pointerEvents: 'box-none',
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: sheetH,
            backgroundColor: T.bg1,
            borderTopLeftRadius: T.radiusXl,
            borderTopRightRadius: T.radiusXl,
            borderTopWidth: 1,
            borderColor: T.borderBright,
            overflow: 'hidden',
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: T.border }} />
          </View>
          {children}
        </View>
      </Animated.View>
    </Modal>
  );
}
