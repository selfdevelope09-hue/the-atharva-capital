import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { T } from '@/src/constants/theme';

type Props = { children: ReactNode };

type State = {
  hasError: boolean;
  message: string;
};

/**
 * Catches render/lifecycle errors in the tree so production builds show a recovery UI instead of a blank screen.
 */
export class AppRootErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: Error): Partial<State> {
    return { hasError: true, message: err?.message ?? 'Unknown error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) {
      console.error('[AppRootErrorBoundary]', error, info.componentStack);
    }
  }

  private reload = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: T.bg0, justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: T.text0, fontSize: 18, fontWeight: '800' }}>Something went wrong</Text>
          <Text style={{ color: T.text3, fontSize: 13, marginTop: 8 }}>
            The app hit a JavaScript error. Details below — you can try reloading.
          </Text>
          <ScrollView style={{ maxHeight: 180, marginTop: 16 }} contentContainerStyle={{ paddingVertical: 4 }}>
            <Text style={{ color: T.text2, fontSize: 12, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }}>
              {this.state.message}
            </Text>
          </ScrollView>
          <Pressable
            onPress={this.reload}
            style={{
              marginTop: 20,
              alignSelf: 'flex-start',
              backgroundColor: T.yellow,
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: T.radiusMd,
            }}
          >
            <Text style={{ color: '#000', fontWeight: '800' }}>{Platform.OS === 'web' ? 'Reload page' : 'Try again'}</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

/** Shown while fonts load — replacing `return null` avoids a blank/black frame on web (dark body). */
export function RootLoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: T.bg0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator size="large" color={T.yellow} />
      <Text style={{ color: T.text3, fontSize: 13, marginTop: 16, fontWeight: '600' }}>Loading…</Text>
    </View>
  );
}

type FontErrProps = { error: Error | null };

export function RootFontErrorScreen({ error }: FontErrProps) {
  const msg = error?.message ?? 'Font loading failed';
  return (
    <View style={{ flex: 1, backgroundColor: T.bg0, justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: T.text0, fontSize: 18, fontWeight: '800' }}>Could not load fonts</Text>
      <Text style={{ color: T.text2, fontSize: 13, marginTop: 10 }}>{msg}</Text>
      <Pressable
        onPress={() => {
          if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.reload();
        }}
        style={{ marginTop: 20, alignSelf: 'flex-start', backgroundColor: T.yellow, paddingHorizontal: 20, paddingVertical: 12, borderRadius: T.radiusMd }}
      >
        <Text style={{ color: '#000', fontWeight: '800' }}>Reload</Text>
      </Pressable>
    </View>
  );
}
