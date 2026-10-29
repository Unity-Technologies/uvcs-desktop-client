/**
 * Marks a query whose result never changes once read (e.g. what a changeset changed), so refreshes skip it. Apart
 * from `queryClient`, which listens to the window, so modules a test loads without one can name it.
 */
export const IMMUTABLE_QUERY = { immutable: true };
