import { useEffect } from 'react';

import { startMarketDataRouter } from '@/services/api/apiRouter';

/**
 * Mounts once at app root: swaps Binance / Angel (future) streams based on `activeMarket`.
 */
export function MarketDataRouter() {
  useEffect(() => startMarketDataRouter(), []);
  return null;
}
