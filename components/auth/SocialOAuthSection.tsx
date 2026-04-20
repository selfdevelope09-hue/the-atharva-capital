import { ResponseType } from 'expo-auth-session';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { finalizeFacebookSignIn, finalizeGoogleSignIn } from '@/services/auth/authProvider';
import { useThemeStore } from '@/store/themeStore';

WebBrowser.maybeCompleteAuthSession();

const googleWeb = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleIos = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const googleAndroid = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const fbAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;

export function SocialOAuthSection() {
  const palette = useThemeStore((s) => s.palette);
  const [busy, setBusy] = useState<'google' | 'facebook' | null>(null);

  const [googleRequest, googleResponse, googlePrompt] = Google.useIdTokenAuthRequest({
    webClientId: googleWeb,
    iosClientId: googleIos,
    androidClientId: googleAndroid,
  });

  const [fbRequest, fbResponse, fbPrompt] = Facebook.useAuthRequest({
    clientId: fbAppId ?? '000000000000000',
    responseType: ResponseType.Token,
  });

  const googleReady = useMemo(() => Boolean(googleWeb || googleIos || googleAndroid), []);
  const fbReady = Boolean(fbAppId);

  useEffect(() => {
    if (googleResponse?.type === 'success' && googleResponse.params?.id_token) {
      void (async () => {
        try {
          await finalizeGoogleSignIn(googleResponse.params.id_token as string);
        } catch (e) {
          Alert.alert('Google sign-in failed', e instanceof Error ? e.message : 'Unknown error');
        } finally {
          setBusy(null);
        }
      })();
    } else if (googleResponse?.type === 'error') {
      setBusy(null);
      Alert.alert('Google sign-in', 'Cancelled or failed');
    }
  }, [googleResponse]);

  useEffect(() => {
    if (fbResponse?.type === 'success' && fbResponse.params?.access_token) {
      void (async () => {
        try {
          await finalizeFacebookSignIn(fbResponse.params.access_token as string);
        } catch (e) {
          Alert.alert('Facebook sign-in failed', e instanceof Error ? e.message : 'Unknown error');
        } finally {
          setBusy(null);
        }
      })();
    } else if (fbResponse?.type === 'error') {
      setBusy(null);
      Alert.alert('Facebook sign-in', 'Cancelled or failed');
    }
  }, [fbResponse]);

  return (
    <View className="gap-3">
      <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
        Linked accounts (same Firebase UID)
      </Text>
      <Pressable
        disabled={!googleRequest || !googleReady || busy !== null}
        onPress={() => {
          setBusy('google');
          void googlePrompt();
        }}
        className="items-center rounded-xl border py-3 active:opacity-80"
        style={{
          borderColor: palette.border,
          backgroundColor: palette.surface2,
          opacity: !googleReady ? 0.45 : 1,
        }}>
        {busy === 'google' ? (
          <ActivityIndicator color={palette.text} />
        ) : (
          <Text className="text-sm font-bold" style={{ color: palette.text }}>
            Continue with Google
          </Text>
        )}
      </Pressable>

      <Pressable
        disabled={!fbRequest || !fbReady || busy !== null}
        onPress={() => {
          setBusy('facebook');
          void fbPrompt();
        }}
        className="items-center rounded-xl border py-3 active:opacity-80"
        style={{
          borderColor: palette.border,
          backgroundColor: palette.surface2,
          opacity: !fbReady ? 0.45 : 1,
        }}>
        {busy === 'facebook' ? (
          <ActivityIndicator color={palette.text} />
        ) : (
          <Text className="text-sm font-bold" style={{ color: palette.text }}>
            Continue with Facebook
          </Text>
        )}
      </Pressable>

      {!googleReady ? (
        <Text className="text-[11px]" style={{ color: palette.textMuted }}>
          Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (and iOS/Android client IDs for native) to `.env` to enable Google.
        </Text>
      ) : null}
      {!fbReady ? (
        <Text className="text-[11px]" style={{ color: palette.textMuted }}>
          Add EXPO_PUBLIC_FACEBOOK_APP_ID to `.env` to enable Facebook.
        </Text>
      ) : null}
    </View>
  );
}
