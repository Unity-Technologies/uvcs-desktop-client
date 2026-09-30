/**
 * How many times `run` calls `owner[method]`: a measure of work that is the same on any machine under any load, unlike
 * the time it takes. The method is wrapped for the run only; unlike `vi.spyOn`, the calls aren't kept, so a run may
 * make millions of them (the comparisons of a diff).
 */
export function countCalls<Owner extends object, T>(owner: Owner, method: keyof Owner & string, run: () => T): { result: T; calls: number } {
  const original = owner[method] as (...args: unknown[]) => unknown;
  const hadItsOwn = Object.hasOwn(owner, method);
  let calls = 0;
  Object.assign(owner, {
    [method](this: unknown, ...args: unknown[]) {
      calls++;
      return original.apply(this, args);
    },
  });
  try {
    const result = run();
    return { result, calls };
  } finally {
    if (hadItsOwn) Object.assign(owner, { [method]: original });
    else delete owner[method];
  }
}
