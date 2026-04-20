/**
 * Mock middleware aggregating four ad networks into one normalized shape.
 */

import { AD_NETWORK_IDS } from '@/services/ads/adNetworks';

export type NativeAd = {
  id: string;
  title: string;
  description: string;
  sponsor: string;
  ctaText: string;
  /** Round-robin network tag for mediation analytics */
  networkId?: string;
};

const NETWORK_A: NativeAd[] = [
  {
    id: 'a-1',
    title: 'Smart tax wrappers',
    description: 'See how an ISA or SIPP could fit your goals — no jargon, clear fees.',
    sponsor: 'NetworkA · WealthGuide',
    ctaText: 'Compare plans',
  },
  {
    id: 'a-2',
    title: 'Cash yield that keeps pace',
    description: 'Treasury-style cash sleeves with same-day liquidity on eligible tiers.',
    sponsor: 'NetworkA · YieldPark',
    ctaText: 'View rates',
  },
];

const NETWORK_B: NativeAd[] = [
  {
    id: 'b-1',
    title: 'Options education hub',
    description: 'Short videos on spreads, Greeks, and risk — built for busy traders.',
    sponsor: 'NetworkB · TradeSchool',
    ctaText: 'Start learning',
  },
  {
    id: 'b-2',
    title: 'Portfolio health check',
    description: 'Stress-test your book against macro scenarios in under two minutes.',
    sponsor: 'NetworkB · RiskLens',
    ctaText: 'Run check',
  },
];

const NETWORK_C: NativeAd[] = [
  {
    id: 'c-1',
    title: 'Lower FX on global fills',
    description: 'Transparent spreads on USD, EUR, and JPY legs with live quotes.',
    sponsor: 'NetworkC · FXClear',
    ctaText: 'See pricing',
  },
  {
    id: 'c-2',
    title: 'Crypto custody basics',
    description: 'Cold storage explainer plus what to ask your exchange or broker.',
    sponsor: 'NetworkC · SafeChain',
    ctaText: 'Read guide',
  },
];

const NETWORK_D: NativeAd[] = [
  {
    id: 'd-1',
    title: 'ESG without the fluff',
    description: 'Holdings-level impact tags you can actually audit, not just badges.',
    sponsor: 'NetworkD · TrueImpact',
    ctaText: 'Explore themes',
  },
  {
    id: 'd-2',
    title: 'Dividend reinvestment',
    description: 'Turn payouts into fractional shares across LSE & US listings.',
    sponsor: 'NetworkD · Dripline',
    ctaText: 'Enable DRIP',
  },
];

const NETWORKS: NativeAd[][] = [NETWORK_A, NETWORK_B, NETWORK_C, NETWORK_D];

let roundRobinNetwork = 0;
const cursorPerNetwork = [0, 0, 0, 0];

/**
 * Picks the next creative in round-robin order across NetworkA→D,
 * advancing a per-network cursor so copy rotates predictably.
 */
export function fetchNextAd(): NativeAd {
  const n = roundRobinNetwork % NETWORKS.length;
  roundRobinNetwork += 1;
  const pool = NETWORKS[n]!;
  const i = cursorPerNetwork[n]! % pool.length;
  cursorPerNetwork[n] = (cursorPerNetwork[n]! + 1) % pool.length;
  const base = pool[i]!;
  return { ...base, networkId: AD_NETWORK_IDS[n] };
}

export const adAggregator = {
  fetchNextAd,
  NETWORKS,
};
