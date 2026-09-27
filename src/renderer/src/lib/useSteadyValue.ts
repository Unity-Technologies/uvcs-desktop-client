import { useEffect, useRef, useState } from 'react';

/** Changes closer together than this are a key held down (macOS repeats every 30–90 ms), not a pick. */
export const KEY_REPEAT_MS = 150;

/**
 * `value`, at once when it changes after a pause (a click, a key tapped), otherwise once it stays put for `delayMs`.
 * Holding ↓ through a list moves the selection every step while what follows it (a diff) waits for the last one.
 */
export function useSteadyValue<T>(value: T, delayMs = KEY_REPEAT_MS): T {
  const [steady, setSteady] = useState(value);
  const lastChangeAt = useRef(-Infinity);

  useEffect(() => {
    const now = performance.now();
    const afterPause = now - lastChangeAt.current >= delayMs;
    lastChangeAt.current = now;
    if (afterPause) {
      setSteady(value);
      return;
    }
    const timer = setTimeout(() => setSteady(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return steady;
}
