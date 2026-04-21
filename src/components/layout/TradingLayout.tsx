/**
 * TradingLayout — 3-panel wrapper (LeftSidebar | main content).
 * On desktop (width >= 900): shows sidebar on the left.
 * On mobile: renders children only; sidebar accessible via MarketScreenTemplate's watchlists tab.
 */

import React, { useState } from 'react';
import { useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { NAV_BREAKPOINT } from '@/constants/theme';
import type { MarketId } from '@/src/constants/markets';
import { LeftSidebar } from './LeftSidebar';

export interface TradingLayoutProps {
  marketId: MarketId;
  children: React.ReactNode;
  /** Override selected symbol from outside (e.g. from a deep-link) */
  initialSymbol?: string | null;
  onSymbolChange?: (symbol: string) => void;
  style?: StyleProp<ViewStyle>;
}

export function TradingLayout({
  marketId,
  children,
  initialSymbol,
  onSymbolChange,
  style,
}: TradingLayoutProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= NAV_BREAKPOINT;

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(initialSymbol ?? null);

  const handleSelectSymbol = (sym: string) => {
    setSelectedSymbol(sym);
    onSymbolChange?.(sym);
  };

  return (
    <View style={[{ flex: 1, flexDirection: isWide ? 'row' : 'column' }, style]}>
      {isWide ? (
        <LeftSidebar
          marketId={marketId}
          selectedSymbol={selectedSymbol}
          onSelectSymbol={handleSelectSymbol}
        />
      ) : null}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
