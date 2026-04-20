/**
 * SmartAPI option-chain wiring (JWT + market-data headers required in production).
 * Returns `null` to signal callers should render exchange-shaped **mock** data.
 */

export type NseOptionGreeks = {
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
};

export type NseOptionSide = {
  oi: number;
  oiChange: number;
  volume: number;
  iv: number;
  ltp: number;
  greeks: NseOptionGreeks;
};

export type NseOptionChainRow = {
  strike: number;
  ce: NseOptionSide;
  pe: NseOptionSide;
};

/**
 * Fetch live NSE option chain for `underlying` (e.g. `NIFTY`) via Angel SmartAPI.
 * TODO: pass bearer + `X-PrivateKey` headers from your session store once login is wired.
 */
export async function fetchNseOptionChainFromAngel(_underlying: string): Promise<NseOptionChainRow[] | null> {
  void _underlying;
  return null;
}

/** Deterministic NSE-shaped rows when SmartAPI returns null (dev / offline). */
export function buildMockNseOptionChain(spot: number, step = 50, bands = 5): NseOptionChainRow[] {
  const center = Math.round(spot / step) * step;
  const rows: NseOptionChainRow[] = [];
  for (let i = -bands; i <= bands; i += 1) {
    const strike = center + i * step;
    const dist = Math.abs(strike - spot) / step;
    const callItm = strike < spot;
    const putItm = strike > spot;
    const intrinsicCall = Math.max(0, spot - strike);
    const intrinsicPut = Math.max(0, strike - spot);
    const ceLtp = Math.max(0.05, intrinsicCall * 0.92 + 18 / (dist + 0.35) + (strike % 11) * 0.02);
    const peLtp = Math.max(0.05, intrinsicPut * 0.92 + 16 / (dist + 0.35) + (strike % 13) * 0.02);
    const ceDelta = callItm ? 0.52 + (1 - dist * 0.08) * 0.35 : 0.48 - dist * 0.06;
    const peDelta = putItm ? -(0.52 + (1 - dist * 0.08) * 0.35) : -(0.48 - dist * 0.06);
    rows.push({
      strike,
      ce: {
        oi: Math.floor(42_000 + dist * 14_000 + (strike % 19) * 200),
        oiChange: Math.floor(-1800 + dist * 900 + (i % 5) * 120),
        volume: Math.floor(6200 + dist * 3100),
        iv: 0.16 + dist * 0.014 + (callItm ? 0.02 : 0),
        ltp: ceLtp,
        greeks: {
          delta: Math.max(0.02, Math.min(0.98, ceDelta)),
          gamma: 0.004 + (1 / (10 + dist * 6)),
          theta: -0.018 - dist * 0.002,
          vega: 0.11 + dist * 0.012,
        },
      },
      pe: {
        oi: Math.floor(38_000 + dist * 12_000 + (strike % 17) * 180),
        oiChange: Math.floor(-1500 + dist * 700 + (i % 4) * 90),
        volume: Math.floor(5800 + dist * 2800),
        iv: 0.17 + dist * 0.013 + (putItm ? 0.02 : 0),
        ltp: peLtp,
        greeks: {
          delta: Math.max(-0.98, Math.min(-0.02, peDelta)),
          gamma: 0.004 + (1 / (10 + dist * 6)),
          theta: -0.017 - dist * 0.002,
          vega: 0.1 + dist * 0.011,
        },
      },
    });
  }
  return rows;
}
