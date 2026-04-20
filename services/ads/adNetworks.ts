/**
 * Round-robin across 4 logical ad networks for all placement types (Phase 27).
 */

export const AD_NETWORK_IDS = ['networkA', 'networkB', 'networkC', 'networkD'] as const;
export type AdNetworkId = (typeof AD_NETWORK_IDS)[number];

let rr = 0;

export function nextNetworkIndex(): number {
  const i = rr % AD_NETWORK_IDS.length;
  rr += 1;
  return i;
}

export function nextNetworkId(): AdNetworkId {
  return AD_NETWORK_IDS[nextNetworkIndex()]!;
}
