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
import { Stack, useRouter, useSegments } from 'expo-router';
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

/**
 * On first mount, unregisters any previously installed service workers
 * (e.g. legacy Monetag SW) so push-notification ads stop running.
 * Does NOT inject any ad scripts — banners are explicit <BannerAd> components.
 */
function AdManager() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    try {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => reg.unregister());
      });
    } catch { /* ignore */ }
  }, []);

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
    useAppLaunchStore.getState().incrementLaunch();
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
