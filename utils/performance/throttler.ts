/**
 * Batches high-frequency stream events (e.g. WebSocket ticks) so UI/store work
 * runs at a human cadence instead of once per inbound frame (~10ms+ bursts).
 */

import type { LiveQuoteMergePayload } from '@/store/marketStore';

export const DEFAULT_QUOTE_THROTTLE_MS = 300;

export type QuoteTick = LiveQuoteMergePayload;

export type QuoteTickBatch = Record<string, QuoteTick>;

export type ThrottledQuoteSink = {
  /** Queue or overwrite latest tick per symbol; schedules a batched flush. */
  push: (symbol: string, tick: QuoteTick) => void;
  /** Drop pending work and cancel the timer (e.g. on socket teardown). */
  cancel: () => void;
  /** Flush immediately (optional: reconnect / teardown). */
  flushNow: () => void;
};

/**
 * Coalesces per-symbol ticks into a single `flush(batch)` at most every `intervalMs`.
 * Latest value wins when the same symbol ticks multiple times within one window.
 */
export function createThrottledQuoteSink(
  intervalMs: number,
  flush: (batch: QuoteTickBatch) => void
): ThrottledQuoteSink {
  const pending: QuoteTickBatch = {};
  let timer: ReturnType<typeof setTimeout> | null = null;

  const runFlush = () => {
    timer = null;
    const keys = Object.keys(pending);
    if (keys.length === 0) return;
    const snapshot: QuoteTickBatch = {};
    for (const k of keys) {
      snapshot[k] = pending[k]!;
      delete pending[k];
    }
    flush(snapshot);
  };

  const schedule = () => {
    if (timer != null) return;
    timer = setTimeout(runFlush, intervalMs);
  };

  const push = (symbol: string, tick: QuoteTick) => {
    pending[symbol] = { ...tick };
    schedule();
  };

  const cancel = () => {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
    for (const k of Object.keys(pending)) delete pending[k];
  };

  const flushNow = () => {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
    runFlush();
  };

  return { push, cancel, flushNow };
}
