import { RecaptchaVerifier } from 'firebase/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { auth, isFirebaseConfigured } from '@/config/firebaseConfig';
import { COUNTRY_DIAL_CODES } from '@/lib/countryDialCodes';
import { clearPendingPhone, confirmPhoneOtp, sendPhoneOtp } from '@/services/auth/authProvider';
import { useThemeStore } from '@/store/themeStore';

export function PhoneAuthSection() {
  const palette = useThemeStore((s) => s.palette);
  const [dial, setDial] = useState('+1');
  const [local, setLocal] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    return () => {
      clearPendingPhone();
      try {
        verifierRef.current?.clear();
      } catch {
        // ignore
      }
      verifierRef.current = null;
    };
  }, []);

  const ensureVerifier = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase not configured');
    }
    if (Platform.OS !== 'web') {
      throw new Error(
        'Phone OTP with invisible reCAPTCHA is wired for web in this build. Use a native ApplicationVerifier for iOS/Android.'
      );
    }
    if (!verifierRef.current) {
      verifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
    return verifierRef.current;
  }, []);

  const onSend = async () => {
    const digits = local.replace(/\D/g, '');
    if (digits.length < 6) {
      Alert.alert('Phone', 'Enter a valid local number.');
      return;
    }
    setBusy(true);
    try {
      const v = await ensureVerifier();
      const e164 = `${dial.replace(/\s/g, '')}${digits}`;
      await sendPhoneOtp(e164, v);
      setSent(true);
    } catch (e) {
      Alert.alert('SMS', e instanceof Error ? e.message : 'Failed to send code');
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = async () => {
    if (code.trim().length < 4) {
      Alert.alert('OTP', 'Enter the SMS code.');
      return;
    }
    setBusy(true);
    try {
      await confirmPhoneOtp(code.trim());
      setCode('');
      setSent(false);
      Alert.alert('Signed in', 'Phone number linked to your universal profile.');
    } catch (e) {
      Alert.alert('OTP', e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-3">
      <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: palette.textMuted }}>
        Phone (OTP)
      </Text>

      {Platform.OS === 'web' ? <View nativeID="recaptcha-container" style={{ height: 1, opacity: 0 }} /> : null}

      <Pressable
        onPress={() => setPickerOpen(true)}
        className="rounded-lg border px-3 py-2"
        style={{ borderColor: palette.border, backgroundColor: palette.surface2 }}>
        <Text className="text-sm font-semibold" style={{ color: palette.text }}>
          Country {dial}
        </Text>
      </Pressable>

      <TextInput
        value={local}
        onChangeText={setLocal}
        placeholder="Mobile number"
        placeholderTextColor={palette.textMuted}
        keyboardType="phone-pad"
        className="rounded-lg border px-3 py-2 text-sm"
        style={{ borderColor: palette.border, color: palette.text, backgroundColor: palette.surface2 }}
      />

      <Pressable
        onPress={() => void onSend()}
        disabled={busy}
        className="items-center rounded-xl py-3"
        style={{ backgroundColor: palette.accent }}>
        <Text className="text-sm font-bold text-black">{busy && !sent ? 'Sending…' : 'Send code'}</Text>
      </Pressable>

      {sent ? (
        <>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="SMS code"
            placeholderTextColor={palette.textMuted}
            keyboardType="number-pad"
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: palette.border, color: palette.text, backgroundColor: palette.surface2 }}
          />
          <Pressable
            onPress={() => void onConfirm()}
            disabled={busy}
            className="items-center rounded-xl border py-3"
            style={{ borderColor: palette.border }}>
            <Text className="text-sm font-bold" style={{ color: palette.text }}>
              Verify & link
            </Text>
          </Pressable>
        </>
      ) : null}

      <Modal visible={pickerOpen} animationType="fade" transparent onRequestClose={() => setPickerOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setPickerOpen(false)}>
          <View className="max-h-[70%] rounded-t-2xl border-t p-4" style={{ backgroundColor: palette.surface }}>
            <Text className="mb-3 text-lg font-bold" style={{ color: palette.text }}>
              Dial code
            </Text>
            <FlatList
              data={COUNTRY_DIAL_CODES}
              keyExtractor={(i) => i.iso + i.dial}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setDial(item.dial);
                    setPickerOpen(false);
                  }}
                  className="border-b py-3"
                  style={{ borderColor: palette.border }}>
                  <Text className="text-base font-semibold" style={{ color: palette.text }}>
                    {item.iso} · {item.name}
                  </Text>
                  <Text className="text-sm" style={{ color: palette.textMuted }}>
                    {item.dial}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
