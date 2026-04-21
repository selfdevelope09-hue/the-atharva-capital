/**
 * Premium login screen — Binance / Angel One inspired dark theme.
 *
 * Platform notes:
 *  - Web   : Google & Facebook use Firebase signInWithPopup (no redirect needed).
 *  - Native: Phone OTP works via Firebase directly.
 *            Google/Facebook on native require adding SHA-1 + OAuth credentials in Firebase
 *            Console and configuring expo-auth-session — shown as "coming soon" for now.
 *
 * Facebook setup checklist (before enabling Facebook login in production):
 *  1. Create a Facebook App at https://developers.facebook.com
 *  2. Add your Firebase project's OAuth redirect URI to Facebook App → Facebook Login → Settings
 *  3. Add Facebook App ID and App Secret in Firebase Console → Authentication → Sign-in method → Facebook
 *  4. For native Android: add SHA-1 fingerprint in Firebase Console → Project Settings → Your apps
 */

import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  type ConfirmationResult,
} from 'firebase/auth';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';

import { auth, isFirebaseConfigured } from '@/config/firebaseConfig';
import { COUNTRY_DIAL_CODES } from '@/lib/countryDialCodes';
import { sendPhoneOtp, confirmPhoneOtp } from '@/services/auth/authProvider';
import { createOrUpdateFirestoreUser } from '@/services/auth/createFirestoreUser';
import { T } from '@/src/constants/theme';

// ─── colour palette ──────────────────────────────────────────────────────────
const BG = '#0b0e11';
const CARD = '#161a1f';
const BORDER = '#2a2e36';
const YELLOW = T.yellow;
const TEXT = '#ffffff';
const MUTED = '#9ca3af';
const FB_BLUE = '#1877F2';
type Step = 'initial' | 'phone' | 'otp';

// ─── helpers ─────────────────────────────────────────────────────────────────
function Divider() {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

// ─── main component ──────────────────────────────────────────────────────────
export function LoginScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('initial');
  const [dialCode, setDialCode] = useState('+91');
  const [showDialPicker, setShowDialPicker] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  // For web direct phone flow (bypasses authProvider wrapper)
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setTimeout(() => setResendTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [resendTimer]);

  // ── reCAPTCHA: initialise on mount (web only) ────────────────────────────
  // Creating the verifier up-front (rather than lazily on button click) ensures
  // the DOM anchor is ready and the invisible widget pre-renders in the background.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !auth) return;

    function createVerifier() {
      try {
        const v = new RecaptchaVerifier(auth!, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {},
          'expired-callback': () => {
            // Token expired — silently recreate so the next OTP attempt works
            try { recaptchaRef.current?.clear(); } catch { /* ignore */ }
            recaptchaRef.current = null;
            createVerifier();
          },
        });
        recaptchaRef.current = v;
        // Also expose on window so Firebase internals can find it if needed
        (window as Record<string, unknown>).recaptchaVerifier = v;
      } catch (e) {
        if (__DEV__) console.warn('[reCAPTCHA] init failed:', e);
      }
    }

    createVerifier();

    return () => {
      try {
        recaptchaRef.current?.clear();
        recaptchaRef.current = null;
        delete (window as Record<string, unknown>).recaptchaVerifier;
      } catch {
        // ignore
      }
    };
  }, []);

  function clearError() {
    setError(null);
  }

  async function afterSignIn() {
    const user = auth?.currentUser;
    if (user) {
      await createOrUpdateFirestoreUser(user);
    }
    // router.replace is handled by AuthGuard (reacts to firebaseUser state change).
    // Calling it here as well is a fast-path in case AuthGuard hasn't fired yet.
    router.replace('/(tabs)');
  }

  // ── Google ────────────────────────────────────────────────────────────────
  async function handleGoogle() {
    if (!isFirebaseConfigured || !auth) {
      setError('Firebase is not configured. Add EXPO_PUBLIC_FIREBASE_* env vars.');
      return;
    }
    clearError();
    setLoading(true);
    try {
      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        await afterSignIn();
      } else {
        Alert.alert(
          'Google Login',
          'Google sign-in is available on the web app at theatharvacapital.com. Native Google login coming soon.',
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('popup-closed-by-user') && !msg.includes('cancelled')) {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Facebook ──────────────────────────────────────────────────────────────
  async function handleFacebook() {
    if (!isFirebaseConfigured || !auth) {
      setError('Firebase is not configured. Add EXPO_PUBLIC_FIREBASE_* env vars.');
      return;
    }
    clearError();
    setLoading(true);
    try {
      if (Platform.OS === 'web') {
        const provider = new FacebookAuthProvider();
        await signInWithPopup(auth, provider);
        await afterSignIn();
      } else {
        Alert.alert(
          'Facebook Login',
          'Facebook sign-in is available on the web app at theatharvacapital.com. Native Facebook login coming soon.',
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('popup-closed-by-user') && !msg.includes('cancelled')) {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Phone OTP — send ──────────────────────────────────────────────────────
  async function handleSendOtp() {
    if (!isFirebaseConfigured || !auth) {
      setError('Firebase is not configured.');
      return;
    }
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 6) {
      setError('Enter a valid phone number.');
      return;
    }
    clearError();
    setLoading(true);
    // Always include country code; strip any leading zeros from the local number
    const e164 = `${dialCode}${digits}`;
    try {
      if (Platform.OS === 'web') {
        // Ensure the verifier is alive (it may have been cleared after a previous error)
        if (!recaptchaRef.current) {
          recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'invisible',
            callback: () => {},
            'expired-callback': () => {
              try { recaptchaRef.current?.clear(); } catch { /* ignore */ }
              recaptchaRef.current = null;
            },
          });
          (window as Record<string, unknown>).recaptchaVerifier = recaptchaRef.current;
        }
        const confirmation = await signInWithPhoneNumber(auth, e164, recaptchaRef.current);
        confirmationRef.current = confirmation;
        // Also store on window for easier access / debugging
        (window as Record<string, unknown>).confirmationResult = confirmation;
      } else {
        await sendPhoneOtp(e164, {} as never);
      }
      setStep('otp');
      setResendTimer(30);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      // Reset reCAPTCHA so the next attempt gets a fresh token
      try {
        recaptchaRef.current?.clear();
        recaptchaRef.current = null;
        delete (window as Record<string, unknown>).recaptchaVerifier;
      } catch {
        // ignore
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Phone OTP — verify ────────────────────────────────────────────────────
  async function handleVerifyOtp() {
    const code = otp.join('');
    if (code.length < 6) {
      setError('Enter all 6 digits.');
      return;
    }
    clearError();
    setLoading(true);
    try {
      if (Platform.OS === 'web') {
        // Use ref; fall back to window global in case of component re-render
        const confirmation =
          confirmationRef.current ??
          ((window as Record<string, unknown>).confirmationResult as ConfirmationResult | undefined);
        if (!confirmation) {
          setError('Session expired. Please resend the OTP.');
          return;
        }
        const result = await confirmation.confirm(code);
        if (result.user) {
          await createOrUpdateFirestoreUser(result.user);
          router.replace('/(tabs)');
        }
      } else {
        const user = await confirmPhoneOtp(code);
        await createOrUpdateFirestoreUser(user);
        router.replace('/(tabs)');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes('invalid-verification-code') ? 'Invalid OTP. Please try again.' : msg);
    } finally {
      setLoading(false);
    }
  }

  // ── OTP digit input helpers ───────────────────────────────────────────────
  function handleOtpChange(text: string, idx: number) {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[idx] = digit;
    setOtp(next);
    if (digit && idx < 5) {
      otpRefs.current[idx + 1]?.focus();
    }
  }

  function handleOtpKeyPress(e: NativeSyntheticEvent<TextInputKeyPressEventData>, idx: number) {
    if (e.nativeEvent.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Invisible reCAPTCHA anchor (web only) */}
      {Platform.OS === 'web' && <View nativeID="recaptcha-container" />}

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Logo ── */}
        <View style={styles.logoArea}>
          <Text style={styles.logoIcon}>⚡</Text>
          <Text style={styles.logoText}>ATHARVA CAPITAL</Text>
          <Text style={styles.tagline}>Trade 9 Global Markets</Text>
        </View>

        {/* ── Card ── */}
        <View style={styles.card}>
          {step === 'initial' && (
            <>
              {/* Google */}
              <Pressable
                style={[styles.btn, styles.btnGoogle]}
                onPress={handleGoogle}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Text style={styles.btnGoogleLetter}>G</Text>
                    <Text style={styles.btnGoogleText}>Continue with Google</Text>
                  </>
                )}
              </Pressable>

              <View style={{ height: 12 }} />

              {/* Facebook */}
              <Pressable
                style={[styles.btn, styles.btnFacebook]}
                onPress={handleFacebook}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.btnFbLetter}>f</Text>
                    <Text style={styles.btnFacebookText}>Continue with Facebook</Text>
                  </>
                )}
              </Pressable>

              <Divider />

              {/* Phone */}
              <Pressable
                style={[styles.btn, styles.btnPhone]}
                onPress={() => { clearError(); setStep('phone'); }}
                disabled={loading}
              >
                <Text style={styles.btnPhoneIcon}>📱</Text>
                <Text style={styles.btnPhoneText}>Continue with Mobile</Text>
              </Pressable>
            </>
          )}

          {step === 'phone' && (
            <>
              <Text style={styles.stepTitle}>Enter your phone number</Text>
              <Text style={styles.stepSub}>We'll send a one-time verification code</Text>

              <View style={styles.phoneRow}>
                {/* Dial code selector */}
                <Pressable
                  style={styles.dialCodeBtn}
                  onPress={() => setShowDialPicker((v) => !v)}
                >
                  <Text style={styles.dialCodeText}>{dialCode} ▾</Text>
                </Pressable>

                {/* Phone input */}
                <TextInput
                  style={styles.phoneInput}
                  placeholder="Phone number"
                  placeholderTextColor={MUTED}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  maxLength={15}
                />
              </View>

              {/* Dial code picker */}
              {showDialPicker && (
                <View style={styles.dialPicker}>
                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                    {COUNTRY_DIAL_CODES.map((c) => (
                      <Pressable
                        key={c.iso}
                        style={styles.dialPickerItem}
                        onPress={() => {
                          setDialCode(c.dial);
                          setShowDialPicker(false);
                        }}
                      >
                        <Text style={styles.dialPickerText}>
                          {c.iso} {c.dial} — {c.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Pressable
                style={[styles.btn, styles.btnYellow, { marginTop: 16 }]}
                onPress={handleSendOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.btnYellowText}>Send OTP</Text>
                )}
              </Pressable>

              <Pressable style={styles.backLink} onPress={() => { clearError(); setStep('initial'); }}>
                <Text style={styles.backLinkText}>← Back</Text>
              </Pressable>
            </>
          )}

          {step === 'otp' && (
            <>
              <Text style={styles.stepTitle}>Enter verification code</Text>
              <Text style={styles.stepSub}>
                Sent to {dialCode} {phone}
              </Text>

              {/* 6-digit OTP boxes */}
              <View style={styles.otpRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(ref) => { otpRefs.current[i] = ref; }}
                    style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                    value={digit}
                    onChangeText={(t) => handleOtpChange(t, i)}
                    onKeyPress={(e) => handleOtpKeyPress(e, i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                  />
                ))}
              </View>

              <Pressable
                style={[styles.btn, styles.btnYellow, { marginTop: 20 }]}
                onPress={handleVerifyOtp}
                disabled={loading || otp.join('').length < 6}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.btnYellowText}>Verify</Text>
                )}
              </Pressable>

              <View style={styles.resendRow}>
                {resendTimer > 0 ? (
                  <Text style={styles.resendTimer}>Resend OTP in {resendTimer}s</Text>
                ) : (
                  <Pressable onPress={handleSendOtp} disabled={loading}>
                    <Text style={styles.resendLink}>Resend OTP</Text>
                  </Pressable>
                )}
              </View>

              <Pressable style={styles.backLink} onPress={() => { clearError(); setStep('phone'); setOtp(['', '', '', '', '', '']); }}>
                <Text style={styles.backLinkText}>← Change number</Text>
              </Pressable>
            </>
          )}

          {/* Error message */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>

        {/* Terms */}
        <Text style={styles.terms}>
          By continuing you agree to our{' '}
          <Text style={styles.termsLink}>Terms of Service</Text>
          {' '}and{' '}
          <Text style={styles.termsLink}>Privacy Policy</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    paddingBottom: 48,
  },

  // Logo
  logoArea: { alignItems: 'center', marginBottom: 36 },
  logoIcon: { fontSize: 48, marginBottom: 4 },
  logoText: {
    fontSize: 26,
    fontWeight: '900',
    color: YELLOW,
    letterSpacing: 1.5,
  },
  tagline: {
    fontSize: 14,
    color: MUTED,
    marginTop: 6,
    letterSpacing: 0.4,
  },

  // Card
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },

  // Base button
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    minHeight: 52,
  },

  // Google button
  btnGoogle: { backgroundColor: '#ffffff' },
  btnGoogleLetter: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4285F4',
    marginRight: 12,
    width: 22,
    textAlign: 'center',
  },
  btnGoogleText: { fontSize: 15, fontWeight: '700', color: '#111111' },

  // Facebook button
  btnFacebook: { backgroundColor: FB_BLUE },
  btnFbLetter: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    marginRight: 12,
    width: 22,
    textAlign: 'center',
  },
  btnFacebookText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },

  // Phone button
  btnPhone: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  btnPhoneIcon: { fontSize: 18, marginRight: 12 },
  btnPhoneText: { fontSize: 15, fontWeight: '700', color: TEXT },

  // Yellow CTA
  btnYellow: { backgroundColor: YELLOW },
  btnYellowText: { fontSize: 15, fontWeight: '800', color: '#000000' },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: BORDER },
  dividerText: {
    color: MUTED,
    fontSize: 13,
    marginHorizontal: 12,
    fontWeight: '600',
  },

  // Step header
  stepTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT,
    marginBottom: 4,
  },
  stepSub: { fontSize: 13, color: MUTED, marginBottom: 20 },

  // Phone row
  phoneRow: { flexDirection: 'row', gap: 10 },
  dialCodeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#1e2229',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: 'center',
  },
  dialCodeText: { color: TEXT, fontWeight: '700', fontSize: 14 },
  phoneInput: {
    flex: 1,
    backgroundColor: '#1e2229',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: TEXT,
    fontSize: 15,
  },

  // Dial picker
  dialPicker: {
    marginTop: 6,
    backgroundColor: '#1e2229',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  dialPickerItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  dialPickerText: { color: TEXT, fontSize: 13 },

  // OTP boxes
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  otpBox: {
    width: 46,
    height: 56,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: '#1e2229',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
    color: TEXT,
  },
  otpBoxFilled: { borderColor: YELLOW },

  // Resend
  resendRow: { alignItems: 'center', marginTop: 16 },
  resendTimer: { color: MUTED, fontSize: 13 },
  resendLink: { color: YELLOW, fontSize: 13, fontWeight: '700' },

  // Back link
  backLink: { alignSelf: 'center', marginTop: 16 },
  backLinkText: { color: MUTED, fontSize: 13 },

  // Error
  errorBox: {
    marginTop: 16,
    backgroundColor: 'rgba(246,70,93,0.12)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: T.red,
  },
  errorText: { color: T.red, fontSize: 13, lineHeight: 18 },

  // Terms
  terms: {
    marginTop: 28,
    fontSize: 12,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 300,
  },
  termsLink: { color: YELLOW, fontWeight: '600' },
});
