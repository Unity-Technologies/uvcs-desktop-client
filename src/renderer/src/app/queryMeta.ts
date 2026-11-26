/**
 * Marks a query whose result never changes once read (e.g. what a changeset changed), so refreshes skip it. Apart
 * from `queryClient`, which listens to the window, so modules a test loads without one can name it.
 */
export const IMMUTABLE_QUERY = { immutable: true };

/**
 * Marks a query whose result never changes once its answer is `lasting`, so refreshes skip it from then on; until then
 * (no answer yet, or one to ask again) refreshes read it as any other.
 */
export function immutableOnceRead(lasting: (data: unknown) => boolean): { immutable: (data: unknown) => boolean } {
  return { immutable: lasting };
}
