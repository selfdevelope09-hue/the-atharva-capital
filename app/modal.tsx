import { Stack, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { auth } from '@/config/firebaseConfig';
import { T } from '@/src/constants/theme';
import { useThemeStore, type ThemePreference } from '@/store/themeStore';

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
  const on = current === value;
  return (
    <Pressable
      onPress={() => {
        void onPick(value);
      }}
      style={{
        marginRight: 8,
        marginBottom: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: on ? T.yellow : T.border,
        backgroundColor: on ? 'rgba(240,185,11,0.15)' : T.bg2,
      }}
    >
      <Text style={{ color: T.text0, fontSize: 12, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

function Row({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: T.border,
      }}
    >
      <Text style={{ color: T.text0, fontSize: 15, fontWeight: '700' }}>{title}</Text>
      {subtitle ? (
        <Text style={{ color: T.text3, fontSize: 12, marginTop: 4 }}>{subtitle}</Text>
      ) : null}
    </Pressable>
  );
}

export default function SettingsModalScreen() {
  const router = useRouter();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  useEffect(() => {
    void useThemeStore.getState().init();
  }, []);

  const signOut = () => {
    try {
      auth?.signOut();
    } catch {
      /* ignore */
    }
    router.replace('/login' as never);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Settings',
          headerStyle: { backgroundColor: T.bg1 },
          headerTintColor: T.text0,
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: T.bg0 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: T.text3, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>
          ACCOUNT
        </Text>
        <View style={{ backgroundColor: T.bg1, borderRadius: T.radiusLg, borderWidth: 1, borderColor: T.border, paddingHorizontal: 16, marginBottom: 24 }}>
          <Row
            title="Edit profile"
            subtitle="Name, bio, and photo"
            onPress={() => {
              router.replace('/profile?edit=1' as never);
            }}
          />
          <Row
            title="Trade history"
            subtitle="Closed positions and profit / loss"
            onPress={() => {
              router.replace('/trades' as never);
            }}
          />
        </View>

        <Text style={{ color: T.text3, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>
          MESSAGING
        </Text>
        <View style={{ backgroundColor: T.bg1, borderRadius: T.radiusLg, borderWidth: 1, borderColor: T.border, paddingHorizontal: 16, marginBottom: 24 }}>
          <Row
            title="Messages"
            subtitle="Direct messages with other traders"
            onPress={() => {
              router.replace('/chats' as never);
            }}
          />
        </View>

        <Text style={{ color: T.text3, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>
          {'NOTIFICATIONS & TOOLS'}
        </Text>
        <View style={{ backgroundColor: T.bg1, borderRadius: T.radiusLg, borderWidth: 1, borderColor: T.border, paddingHorizontal: 16, marginBottom: 24 }}>
          <Row
            title="Price alerts"
            onPress={() => {
              router.replace('/alerts' as never);
            }}
          />
          <Row
            title="Trading journal"
            onPress={() => {
              router.replace('/journal' as never);
            }}
          />
        </View>

        <Text style={{ color: T.text3, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>
          APPEARANCE
        </Text>
        <View style={{ backgroundColor: T.bg1, borderRadius: T.radiusLg, borderWidth: 1, borderColor: T.border, padding: 16, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <ThemeChip label="System" value="system" current={preference} onPick={setPreference} />
            <ThemeChip label="Dark" value="dark" current={preference} onPick={setPreference} />
            <ThemeChip label="Light" value="light" current={preference} onPick={setPreference} />
          </View>
        </View>

        <Pressable
          onPress={signOut}
          style={{
            paddingVertical: 14,
            borderRadius: T.radiusMd,
            backgroundColor: T.bg2,
            borderWidth: 1,
            borderColor: T.red,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: T.red, fontWeight: '800', fontSize: 15 }}>Sign out</Text>
        </Pressable>

        {Platform.OS === 'web' ? (
          <Text style={{ color: T.text3, fontSize: 11, textAlign: 'center', marginTop: 20 }}>
            Tip: keep this tab focused while charts load — embeds need a stable layout.
          </Text>
        ) : null}
      </ScrollView>
    </>
  );
}
