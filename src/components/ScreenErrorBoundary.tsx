/**
 * Per-screen error boundary — catches render errors in new screens
 * so they show a friendly fallback instead of crashing the whole app.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { T } from '@/src/constants/theme';

interface State {
  error: Error | null;
}

export class ScreenErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: T.bg0, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>⚠️</Text>
          <Text style={{ color: T.text0, fontSize: 18, fontWeight: '800', marginBottom: 8 }}>
            Something went wrong
          </Text>
          <Text style={{ color: T.text2, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </Text>
          <Pressable
            onPress={() => this.setState({ error: null })}
            style={{ backgroundColor: T.yellow, paddingHorizontal: 24, paddingVertical: 12, borderRadius: T.radiusMd }}
          >
            <Text style={{ color: '#000', fontWeight: '800' }}>Try Again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
