import React from 'react';
import MarketScreenTemplate from './MarketScreenTemplate';

/** India (NSE) — equity tabs + F&O (indices / liquid ETFs). */
export default function IndiaMarketScreen() {
  return <MarketScreenTemplate marketId="india" showFoTab />;
}
