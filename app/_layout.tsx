// ─── MUST be the very first import — sets up global polyfills before anything else ───
import '@/src/globals';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../global.css';

import { AppRootErrorBoundary, RootFontErrorScreen, RootLoadingScreen } from '@/components/AppRootErrorBoundary';
import { InterstitialModal } from '@/components/ads/InterstitialModal';
import { SmartBanner } from '@/components/ads/SmartBanner';
import { AlertPriceMonitor } from '@/components/AlertPriceMonitor';
import { AuthProfileBridge } from '@/components/AuthProfileBridge';
import { InAppToastHost } from '@/components/InAppToastHost';
import { MarketDataRouter } from '@/components/MarketDataRouter';
import { useColorScheme } from '@/components/useColorScheme';
import { PriceProvider } from '@/contexts/PriceContext';
import { UnifiedMarketsPriceProvider } from '@/contexts/UnifiedMarketsPriceContext';
import { isFirebaseConfigured } from '@/config/firebaseConfig';
import { bootFirebaseAuthAndProfile } from '@/services/firebase/bootAuth';
import { useAppLaunchStore } from '@/store/appLaunchStore';
import { useInterstitialUiStore } from '@/store/interstitialUiStore';
import { useProfileStore } from '@/store/profileStore';
import { useThemeStore } from '@/store/themeStore';

let rootLaunchIncrementedThisJsContext = false;

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const WEB_SHELL_BG = '#0b0e11';

// Auth screens where ads must NEVER be shown
const AUTH_PATHS = new Set(['/login', '/signup', '/otp']);
function isAuthPath(pathname: string) {
  return AUTH_PATHS.has(pathname) || pathname.includes('/auth');
}

/**
 * Injects Monetag ad script + SW registration ONLY after the user is logged in
 * AND is not on an auth screen.  Uses `usePathname` from Expo Router — must be
 * rendered inside the navigation context (i.e. inside AppContent).
 */
function AdManager() {
  const pathname = usePathname();
  const firebaseUser = useProfileStore((s) => s.firebaseUser);
  const adInjectedRef = useRef(false);
  const swRegisteredRef = useRef(false);

  const isRealUser = Boolean(firebaseUser && !firebaseUser.isAnonymous);
  const onAuthScreen = isAuthPath(pathname);
  const shouldShowAds = isRealUser && !onAuthScreen && Platform.OS === 'web';

  // Monetag main script — injected once, never on auth screens
  useEffect(() => {
    if (!shouldShowAds || typeof document === 'undefined') return;
    if (adInjectedRef.current) return;

    try {
      // Guard against duplicate injection across re-renders
      if (document.querySelector('script[data-zone="232062"]')) {
        adInjectedRef.current = true;
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://quge5.com/88/tag.min.js';
      script.setAttribute('data-zone', '232062');
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      document.head.appendChild(script);
      adInjectedRef.current = true;
    } catch (e) {
      console.log('[Monetag] ad script load failed:', e);
    }
  }, [shouldShowAds]);

  // Service worker (Monetag push) — registered once, never on auth screens
  useEffect(() => {
    if (!shouldShowAds || typeof window === 'undefined') return;
    if (swRegisteredRef.current) return;
    if (!('serviceWorker' in navigator)) return;

    try {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => {
          swRegisteredRef.current = true;
          console.log('[SW] registered');
        })
        .catch((err) => console.log('[SW] error:', err));
    } catch (e) {
      console.log('[Monetag] SW registration failed:', e);
    }
  }, [shouldShowAds]);

  return null;
}

/**
 * Auth guard rendered inside the Expo Router tree.
 * Waits for `authInitialized` so we never redirect before the first auth callback fires.
 */
function AuthGuard() {
  const authInitialized = useProfileStore((s) => s.authInitialized);
  const firebaseUser = useProfileStore((s) => s.firebaseUser);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!authInitialized) return;
    if (!isFirebaseConfigured) return;

    const inLoginPage = segments[0] === 'login';
    const isRealUser = Boolean(firebaseUser && !firebaseUser.isAnonymous);

    if (!isRealUser && !inLoginPage) {
      router.replace('/login');
    } else if (isRealUser && inLoginPage) {
      router.replace('/(tabs)');
    }
  }, [authInitialized, firebaseUser, segments, router]);

  return null;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  // Force dark background on web shell before React hydrates
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.style.background = WEB_SHELL_BG;
    document.body.style.background = WEB_SHELL_BG;
    document.body.style.margin = '0';
    const root = document.getElementById('root');
    if (root) {
      root.style.backgroundColor = WEB_SHELL_BG;
      root.style.minHeight = '100%';
    }
  }, []);

  useEffect(() => {
    if (error && __DEV__) {
      console.error('[fonts]', error);
    }
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  /**
   * Providers are hoisted ABOVE the font-loading gate so they're always mounted.
   * This prevents any "hook called outside provider" crash during static HTML
   * hydration, where pre-rendered screen content may try to access context before
   * the provider mounts.
   */
  return (
    <AppRootErrorBoundary>
      <SafeAreaProvider>
        <UnifiedMarketsPriceProvider>
          <PriceProvider>
            {/* Null-rendering side-effect components that use provider hooks */}
            <AlertPriceMonitor />
            <AuthProfileBridge />
            <InAppToastHost />
            <MarketDataRouter />

            {error ? (
              <RootFontErrorScreen error={error} />
            ) : !loaded ? (
              <RootLoadingScreen />
            ) : (
              <AppContent />
            )}
          </PriceProvider>
        </UnifiedMarketsPriceProvider>
      </SafeAreaProvider>
    </AppRootErrorBoundary>
  );
}

function AppContent() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    void useThemeStore.getState().init();
  }, []);

  useEffect(() => {
    void bootFirebaseAuthAndProfile().catch((err) => {
      if (__DEV__) {
        console.warn('[Firebase] bootFirebaseAuthAndProfile failed', err);
      }
    });
  }, []);

  useEffect(() => {
    if (rootLaunchIncrementedThisJsContext) return;
    rootLaunchIncrementedThisJsContext = true;
    const n = useAppLaunchStore.getState().incrementLaunch();
    if (n >= 3 && n % 3 === 0) {
      useInterstitialUiStore.getState().show('launch');
    }
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1 }}>
        {/* AuthGuard + AdManager both need to be inside the navigation context */}
        <AuthGuard />
        <AdManager />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          <Stack.Screen name="v2" options={{ headerShown: false }} />
          <Stack.Screen name="markets" options={{ headerShown: false }} />
        </Stack>
        <SmartBanner />
        <InterstitialModal />
      </View>
    </ThemeProvider>
  );
}
