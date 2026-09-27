/**
 * Reads until a read succeeds, then answers every later call with that result; calls while a read runs share it.
 * For what every window asks when it opens and stays true once it is (`cm` runs, it reaches its server).
 */
export function untilSucceeded<T>(read: () => Promise<T>, succeeded: (value: T) => boolean = () => true): () => Promise<T> {
  let answer: Promise<T> | null = null;
  return () => {
    answer ??= read().then(
      (value) => {
        if (!succeeded(value)) answer = null;
        return value;
      },
      (error: unknown) => {
        answer = null;
        throw error;
      },
    );
    return answer;
  };
}
