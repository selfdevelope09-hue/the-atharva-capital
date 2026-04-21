import { useMemo } from 'react';

import { getMarket, type MarketConfig } from '@/src/constants/markets';
import {
  buildMarketRegionUiConfig,
  type MarketRegionUiConfig,
  type TradingRegion,
} from '@/src/constants/marketRegionUi';

export type { TradingRegion, MarketRegionUiConfig };

/**
 * Returns localized UI configuration for the order panel: allowed order modes,
 * quantity rules, leverage bounds, fee display lines, and region copy.
 */
export function useMarketConfig(symbol: string, region: TradingRegion): MarketRegionUiConfig {
  const market: MarketConfig | null = useMemo(() => {
    if (region === 'forex' || region === 'brazil') return null;
    return getMarket(region);
  }, [region]);

  return useMemo(
    () => buildMarketRegionUiConfig(symbol, region, market),
    [symbol, region, market]
  );
}
