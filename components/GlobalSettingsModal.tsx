import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { PhoneAuthSection } from '@/components/auth/PhoneAuthSection';
import { SocialOAuthSection } from '@/components/auth/SocialOAuthSection';
import { useThemeStore, type ThemePreference } from '@/store/themeStore';
import { useUiStore } from '@/store/uiStore';

function ThemeChip({
  label,
  value,
  current,
  onPick,
}: {
  label: string;
  value: ThemePreference;
  current: ThemePreference;
  onPick: (v: ThemePreference) => void | Promise<void>;
}) {
  const palette = useThemeStore((s) => s.palette);
  const on = current === value;
  return (
    <Pressable
      onPress={() => {
        void onPick(value);
      }}
      className="mr-2 rounded-full border px-3 py-2"
      style={{
        borderColor: on ? palette.accent : palette.border,
        backgroundColor: on ? `${palette.accent}22` : palette.surface2,
      }}>
      <Text className="text-xs font-bold" style={{ color: palette.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function GlobalSettingsModal() {
  const open = useUiStore((s) => s.settingsOpen);
  const close = useUiStore((s) => s.closeSettings);
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const palette = useThemeStore((s) => s.palette);

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={close}>
        <Pressable
          className="max-h-[88%] rounded-t-3xl border-t px-4 pb-8 pt-3"
          style={{ backgroundColor: palette.surface, borderColor: palette.border }}
          onPress={(e) => e.stopPropagation()}>
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-black" style={{ color: palette.text }}>
              Account & theme
            </Text>
            <Pressable onPress={close} hitSlop={12} accessibilityRole="button">
              <FontAwesome name="close" size={22} color={palette.textMuted} />
            </Pressable>
          </View>

          <Text className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
            Appearance
          </Text>
          <View className="mb-6 flex-row flex-wrap">
            <ThemeChip label="System" value="system" current={preference} onPick={setPreference} />
            <ThemeChip label="Dark" value="dark" current={preference} onPick={setPreference} />
            <ThemeChip label="Light" value="light" current={preference} onPick={setPreference} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <SocialOAuthSection />
            <View className="my-6 h-px" style={{ backgroundColor: palette.border }} />
            <PhoneAuthSection />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
