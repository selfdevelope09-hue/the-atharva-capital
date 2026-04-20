/**
 * Black–Scholes closed-form prices & sensitivities (EU options, continuous yield).
 * Used for institutional-style chain displays; keep call sites off the critical path
 * via `greeksAsync` chunking.
 */

function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/** Abramowitz & Stegun 7.1.26 — standard-normal CDF (accurate for option-chain UI). */
export function normCdf(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.2316419 * z);
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

export type BsGreeks = {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
};

function clampSigma(sigma: number): number {
  if (!Number.isFinite(sigma) || sigma <= 0) return 0.01;
  return Math.min(Math.max(sigma, 0.005), 3);
}

function d12(S: number, K: number, T: number, r: number, sigma: number): { d1: number; d2: number; sqrtT: number } {
  const sig = clampSigma(sigma);
  const sqrtT = Math.sqrt(Math.max(T, 1e-8));
  const d1 = (Math.log(S / K) + (r + 0.5 * sig * sig) * T) / (sig * sqrtT);
  const d2 = d1 - sig * sqrtT;
  return { d1, d2, sqrtT };
}

/** Per-calendar-year theta (same sign convention as most textbooks). */
export function blackScholesCallGreeks(S: number, K: number, T: number, r: number, sigma: number): BsGreeks {
  const sig = clampSigma(sigma);
  const { d1, d2, sqrtT } = d12(S, K, T, r, sig);
  const nd1 = normCdf(d1);
  const pdf = normPdf(d1);
  const discount = Math.exp(-r * T);
  const delta = nd1;
  const gamma = pdf / (S * sig * sqrtT);
  const vega = S * pdf * sqrtT;
  const theta = (-(S * pdf * sig) / (2 * sqrtT) - r * K * discount * normCdf(d2)) / 365;
  return { delta, gamma, theta, vega };
}

export function blackScholesPutGreeks(S: number, K: number, T: number, r: number, sigma: number): BsGreeks {
  const sig = clampSigma(sigma);
  const { d1, d2, sqrtT } = d12(S, K, T, r, sig);
  const pdf = normPdf(d1);
  const discount = Math.exp(-r * T);
  const delta = normCdf(d1) - 1;
  const gamma = pdf / (S * sig * sqrtT);
  const vega = S * pdf * sqrtT;
  const theta = (-(S * pdf * sig) / (2 * sqrtT) + r * K * discount * normCdf(-d2)) / 365;
  return { delta, gamma, theta, vega };
}
