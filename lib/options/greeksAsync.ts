import type { NseOptionChainRow } from '@/services/api/angelOptionChain';

import { blackScholesCallGreeks, blackScholesPutGreeks } from './blackScholes';

/** Yield to the JS event loop between chunks (simulates worker handoff / avoids long tasks). */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const DEFAULT_CHUNK = 3;

/**
 * Recomputes CE/PE Greeks from Black–Scholes using row IVs, in small chunks so the
 * main thread never sits in one long synchronous slice (true workers need native wiring).
 */
export async function enrichOptionChainGreeksAsync(
  spot: number,
  rows: NseOptionChainRow[],
  opts?: { riskFreeRate?: number; tYears?: number; chunkSize?: number }
): Promise<NseOptionChainRow[]> {
  const riskFreeRate = opts?.riskFreeRate ?? 0.065;
  const tYears = opts?.tYears ?? 14 / 365;
  const chunkSize = opts?.chunkSize ?? DEFAULT_CHUNK;
  const out: NseOptionChainRow[] = new Array(rows.length);

  for (let i = 0; i < rows.length; i += chunkSize) {
    await yieldToEventLoop();
    const end = Math.min(i + chunkSize, rows.length);
    for (let j = i; j < end; j += 1) {
      const r = rows[j]!;
      const ceG = blackScholesCallGreeks(spot, r.strike, tYears, riskFreeRate, r.ce.iv);
      const peG = blackScholesPutGreeks(spot, r.strike, tYears, riskFreeRate, r.pe.iv);
      out[j] = {
        ...r,
        ce: {
          ...r.ce,
          greeks: {
            delta: ceG.delta,
            gamma: ceG.gamma,
            theta: ceG.theta,
            vega: ceG.vega,
          },
        },
        pe: {
          ...r.pe,
          greeks: {
            delta: peG.delta,
            gamma: peG.gamma,
            theta: peG.theta,
            vega: peG.vega,
          },
        },
      };
    }
  }

  return out;
}
