/**
 * The places with review mode on (`reviewModeWorkspaces`), each by the key the main process keeps it by
 * (`api.review.reviewModeKey`: its GUID), after turning it on or off for one of them.
 */
export function withReviewMode(places: readonly string[], key: string, on: boolean): string[] {
  const others = places.filter((place) => place !== key);
  return on ? [...others, key] : others;
}

/** Whether review mode is on for the place of `key`; off while the key isn't known yet. */
export function isReviewModeOn(places: readonly string[], key: string | undefined): boolean {
  return key !== undefined && places.includes(key);
}
