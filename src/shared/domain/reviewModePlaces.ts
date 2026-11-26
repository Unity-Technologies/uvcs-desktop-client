import { placeId, type Place } from './place';

// The places with review mode on (`AppSettings.reviewModeWorkspaces`), each by the key the main process keeps it by:
// its workspace's or repository's GUID (`reviewModeKeyOf`), or its `placeId` when `cm` can't tell one.

/**
 * Whether a place's key is worth asking for to show whether review mode is on: with no place on, it's off for every
 * place, and a repository's key (a server listing) isn't read just to show the toggle off.
 */
export function needsReviewModeKey(places: readonly string[]): boolean {
  return places.length > 0;
}

/**
 * Whether `key` is the place's for good: its GUID never changes. The place's `placeId`, kept while no GUID could be
 * told (a `cm` that failed, a server that couldn't be listed), is asked for again.
 */
export function isLastingReviewModeKey(place: Place, key: string | undefined): boolean {
  return key !== undefined && key !== placeId(place);
}

/** Whether review mode is on for the place of `key`; off while the key isn't known yet. */
export function isReviewModeOn(places: readonly string[], key: string | undefined): boolean {
  return key !== undefined && places.includes(key);
}

/** The places with review mode on, after turning it on or off for the place of `key`. */
export function withReviewMode(places: readonly string[], key: string, on: boolean): string[] {
  const others = places.filter((place) => place !== key);
  return on ? [...others, key] : others;
}

/**
 * The places with review mode on, once what was kept by `from` (the place's `placeId`, as review mode was kept before)
 * is kept by `to` (its GUID); undefined when nothing moves.
 */
export function movedReviewMode(places: readonly string[], from: string, to: string): string[] | undefined {
  if (from === to || !places.includes(from)) return undefined;
  return [...places.filter((place) => place !== from && place !== to), to];
}
