/** Timers may fire a millisecond early; this keeps the wait past the second's end. */
const MARGIN_MS = 10;

/**
 * How long until the clock is in the next second. `cm` tells a file changed by its size and its modification time to
 * the second, so a file it wrote, rewritten with as many bytes in that same second, looks unchanged: its local changes
 * would be left out of the pending changes and overwritten by the next update.
 */
export function msUntilNextSecond(nowMs: number): number {
  return 1000 - (nowMs % 1000) + MARGIN_MS;
}

/** Waits until files written now can't share a second with what `cm` wrote before. */
export function waitForNextSecond(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, msUntilNextSecond(Date.now())));
}
