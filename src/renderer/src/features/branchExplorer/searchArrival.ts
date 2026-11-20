/**
 * How long a typed query stays put before the graph goes to its first hit by itself: long enough that the keys of a
 * word or a number don't move the view at each one, short enough to feel as if the search went there at once.
 */
export const FIRST_HIT_PAUSE_MS = 300;

/** Where the search stands when the graph may go to its first hit. */
export interface SearchMoment {
  /** The typed query has stayed put for `FIRST_HIT_PAUSE_MS`. */
  typedSettled: boolean;
  /** The hits are the typed query's, not an earlier one's the graph still shows (`useGraphSearch`'s `shown`). */
  searchCaughtUp: boolean;
  hitCount: number;
}

/** Whether a query just typed is still to go to its first hit; a cleared search never moves the view. */
export function awaitsFirstHit(typed: string): boolean {
  return typed.trim() !== '';
}

/**
 * Whether the graph goes to the first hit now, as Enter would (`steppedHitIndex`): once per query typed, after it
 * settled and found something. `awaiting` is false once it went there or the user stepped, so panning, stepping or
 * the graph laid out again never pulls the view back to it.
 */
export function goesToFirstHit(awaiting: boolean, moment: SearchMoment): boolean {
  return awaiting && moment.typedSettled && moment.searchCaughtUp && moment.hitCount > 0;
}
