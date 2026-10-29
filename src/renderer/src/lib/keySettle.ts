/** Says when what shows (`show`, by its key) has stayed put for `delayMs`; `stop` drops a wait. */
export interface KeySettle {
  show: (key: string) => void;
  stop: () => void;
}

/**
 * Settles a key once it stayed shown for the whole of `delayMs`, the first one too (unlike `useSettledValue`, which
 * takes a change after a pause at once): for work a glance must never start, such as a comment's reads of other
 * repositories' objects as rows are arrowed through. A key shown again as it is restarts nothing.
 */
export function keySettle(settled: (key: string) => void, delayMs: number): KeySettle {
  let shown: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    show: (key) => {
      if (key === shown) return;
      shown = key;
      clearTimeout(timer);
      timer = setTimeout(() => settled(key), delayMs);
    },
    stop: () => clearTimeout(timer),
  };
}
