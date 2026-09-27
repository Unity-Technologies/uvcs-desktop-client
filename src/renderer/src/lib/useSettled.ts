import { useEffect, useRef, useState } from 'react';

/** How long a selection has to stay put before its details ask `cm` for more. */
export const SELECTION_SETTLE_MS = 300;

/**
 * False until `delayMs` after the component mounts. Details panels are keyed by the selected object, so a query
 * enabled by this runs only once the user stops on a row, not for every row an arrow key passes through.
 */
export function useSettled(delayMs = SELECTION_SETTLE_MS): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);
  return settled;
}

/**
 * `value` once its `key` stays put, for details that ask `cm` about the selected row (a revision's diff or annotation):
 * a change after a pause shows at once, while the rows an arrow key passes through are skipped until it stops. Until
 * then the value of the last settled key is kept on screen.
 */
export function useSettledValue<T>(value: T, key: string, delayMs = SELECTION_SETTLE_MS): T {
  const [settled, setSettled] = useState({ key, value });
  const lastChangeAt = useRef(-Infinity);

  useEffect(() => {
    if (key === settled.key) return;
    const now = performance.now();
    const delay = settleDelay(now, lastChangeAt.current, delayMs);
    lastChangeAt.current = now;
    const timer = setTimeout(() => setSettled({ key, value }), delay);
    return () => clearTimeout(timer);
    // Keyed by `key` alone: the value it names is taken as it was when the key changed.
  }, [key]);

  return key === settled.key ? value : settled.value;
}

/** No wait for a change after a pause; a full one for a change that follows another within the delay. */
export function settleDelay(now: number, lastChangeAt: number, delayMs: number): number {
  return now - lastChangeAt >= delayMs ? 0 : delayMs;
}
