/**
 * Runs tasks at most `most` at once, the others in the order they came. A finished task hands its slot straight to the
 * next one waiting, never freeing it on the way: one asked for just then can't slip in past the limit.
 */
export function concurrencyLimit(most: number): <T>(task: () => Promise<T>) => Promise<T> {
  let running = 0;
  const waiting: (() => void)[] = [];
  return async (task) => {
    if (running < most) running++;
    else await new Promise<void>((resolve) => waiting.push(resolve));
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else running--;
    }
  };
}
