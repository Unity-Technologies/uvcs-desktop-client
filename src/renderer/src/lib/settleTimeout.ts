/**
 * The waits for a selection or a key to stay put (`useSettled`, `useSettledValue`, `keySettle`) still pending in this
 * window. Each is a read about to start: `markReadsInFlight` counts them with the reads under way, so the smoke test
 * ends a step only once the reads its last click asked for have started and ended (scripts/e2e/README.md, "Duplicate
 * server commands").
 */
let pending = 0;
const listeners = new Set<() => void>();

/** Runs `settled` after `delayMs`, counted as pending until then; the function returned cancels it. */
export function settleTimeout(settled: () => void, delayMs: number): () => void {
  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    pending -= 1;
    listeners.forEach((listener) => listener());
  };
  const timer = setTimeout(() => {
    finish();
    settled();
  }, delayMs);
  pending += 1;
  listeners.forEach((listener) => listener());
  return finish;
}

/** How many settle waits are pending. */
export function pendingSettleCount(): number {
  return pending;
}

/** Calls `listener` whenever a settle wait starts or ends; the function returned stops it. */
export function onPendingSettlesChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
