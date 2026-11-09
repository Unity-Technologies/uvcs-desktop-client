/**
 * Hands on the last value pushed once no other came for `delayMs`: what `useDebouncedValue` settles on. A changeset's
 * number typed a key at a time (`cs:4207`) settles on 4207 alone, never on 4, 42 or 420 on the way.
 */
export function createTrailingDebounce<T>(settled: (value: T) => void): { push: (value: T, delayMs: number) => void; stop: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    push: (value, delayMs) => {
      clearTimeout(timer);
      timer = setTimeout(() => settled(value), delayMs);
    },
    stop: () => clearTimeout(timer),
  };
}
