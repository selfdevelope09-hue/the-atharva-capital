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
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';
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
import { bootFirebaseAuthAndProfile } from '@/services/firebase/bootAuth';
import { useAppLaunchStore } from '@/store/appLaunchStore';
import { useInterstitialUiStore } from '@/store/interstitialUiStore';
import { useThemeStore } from '@/store/themeStore';

let rootLaunchIncrementedThisJsContext = false;

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

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

  if (error) {
    return <RootFontErrorScreen error={error} />;
  }

  if (!loaded) {
    return <RootLoadingScreen />;
  }

  return (
    <AppRootErrorBoundary>
      <RootLayoutNav />
    </AppRootErrorBoundary>
  );
}

function RootLayoutNav() {
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
    <SafeAreaProvider>
      <AuthProfileBridge />
      <AlertPriceMonitor />
      <InAppToastHost />
      <MarketDataRouter />
      <UnifiedMarketsPriceProvider>
        <PriceProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <View style={{ flex: 1 }}>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
                <Stack.Screen name="v2" options={{ headerShown: false }} />
                <Stack.Screen name="markets" options={{ headerShown: false }} />
              </Stack>
              <SmartBanner />
              <InterstitialModal />
            </View>
          </ThemeProvider>
        </PriceProvider>
      </UnifiedMarketsPriceProvider>
    </SafeAreaProvider>
  );
}
