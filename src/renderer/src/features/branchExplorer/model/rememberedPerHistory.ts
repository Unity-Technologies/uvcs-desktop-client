const byHistory = new WeakMap<object, Map<string, { deps: readonly unknown[]; value: unknown }>>();

/**
 * What was last computed from a loaded history for a purpose, while its inputs stay the same: coming back to the
 * Branch Explorer doesn't filter and lay out a long history again. Kept for as long as the history itself is (the
 * query cache holds it), so nothing outlives what it was computed from.
 */
export function rememberedPerHistory<T>(history: object, purpose: string, deps: readonly unknown[], compute: () => T): T {
  let entries = byHistory.get(history);
  if (!entries) byHistory.set(history, (entries = new Map()));
  const known = entries.get(purpose);
  if (known && known.deps.length === deps.length && known.deps.every((dep, index) => Object.is(dep, deps[index]))) return known.value as T;
  const value = compute();
  entries.set(purpose, { deps, value });
  return value;
}
