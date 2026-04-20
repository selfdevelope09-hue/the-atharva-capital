const ALPHANUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Public client handle, e.g. `ATC-K7P2M9` (no ambiguous 0/O/1/I). */
export function generateAtcClientId(): string {
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
  }
  return `ATC-${suffix}`;
}
