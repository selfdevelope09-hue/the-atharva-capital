/**
 * USDT spot-style symbols wired to Binance `@ticker` combined streams on the CRYPTO venue.
 * Keep this list modest for mobile battery / socket fan-in (expand later if needed).
 */
export const CRYPTO_USDT_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'AVAXUSDT',
  'LINKUSDT',
] as const;

export type CryptoUsdtSymbol = (typeof CRYPTO_USDT_SYMBOLS)[number];

export function cryptoBinanceTickerStreams(): string[] {
  return CRYPTO_USDT_SYMBOLS.map((s) => `${s.toLowerCase()}@ticker`);
}
