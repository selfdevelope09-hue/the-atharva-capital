/**
 * Re-exports Phase 1 unified pricing (all 9 markets + isolation).
 * @see `contexts/UnifiedMarketsPriceContext.tsx`
 */
export {
  UnifiedMarketsPriceProvider,
  UnifiedMarketsPriceProvider as MarketPriceProvider,
  useUnifiedMarketsPrices,
  useMarketPrices,
  useMarketSubscribe,
  useTick,
  type UnifiedMarketTick,
  type UnifiedMarketTick as MarketTick,
  type UnifiedMarketsPriceContextValue,
  type WsStatus,
} from '@/contexts/UnifiedMarketsPriceContext';
