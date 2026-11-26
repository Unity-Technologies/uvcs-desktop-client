import { steppedHitIndex, type SearchHit } from './model/searchGraph';

/**
 * How long a typed query stays put before the graph goes to its first hit by itself: long enough that the pauses
 * between the digits of a changeset number don't select a partial match, short enough to feel as if it went at once.
 */
export const FIRST_HIT_PAUSE_MS = 500;

/** The graph's search, apart from the hits themselves (`searchGraph`), which depend on the layout. */
export interface GraphSearchState {
  text: string;
  /** Bumped by every key, so a settle (`FIRST_HIT_PAUSE_MS`) is for the query typed last, even one typed before. */
  generation: number;
  /** The hit the search stepped to; -1 until it steps. */
  activeHitIndex: number;
  /** The query typed is still to go to its first hit by itself. */
  awaitingFirstHit: boolean;
}

export const NO_SEARCH: GraphSearchState = { text: '', generation: 0, activeHitIndex: -1, awaitingFirstHit: false };

export type GraphSearchEvent =
  | { kind: 'typed'; value: string }
  /** Next (`1`) or previous (`-1`) match, through the hits of what is typed. */
  | { kind: 'stepped'; direction: 1 | -1; hits: readonly SearchHit[] }
  /**
   * The query typed last stayed put for `FIRST_HIT_PAUSE_MS` and the graph searched it: its hits, or null while the
   * graph isn't laid out yet.
   */
  | { kind: 'settled'; hits: readonly SearchHit[] | null };

/**
 * The search after an event. A query goes to its first hit once, when it settles, as Next match would
 * (`steppedHitIndex`); a cleared one never moves the view. It stops waiting once it went there, the user stepped, or it
 * settled on a laid-out graph with nothing found, so a refresh that later finds something never pulls the view away
 * from where the user moved it.
 */
export function graphSearchState(state: GraphSearchState, event: GraphSearchEvent): GraphSearchState {
  switch (event.kind) {
    case 'typed':
      return { text: event.value, generation: state.generation + 1, activeHitIndex: -1, awaitingFirstHit: event.value.trim() !== '' };
    case 'stepped':
      if (event.hits.length === 0) return state;
      return { ...state, activeHitIndex: steppedHitIndex(state.activeHitIndex, event.direction, event.hits, state.text), awaitingFirstHit: false };
    case 'settled':
      if (!state.awaitingFirstHit || event.hits === null) return state;
      if (event.hits.length === 0) return { ...state, awaitingFirstHit: false };
      return graphSearchState(state, { kind: 'stepped', direction: 1, hits: event.hits });
  }
}

/** The hit the graph goes to, between the search before an event and after it: null when the event moved nothing. */
export function hitGoneTo(before: GraphSearchState, after: GraphSearchState, hits: readonly SearchHit[]): SearchHit | null {
  if (after === before || after.activeHitIndex === -1) return null;
  return hits[after.activeHitIndex] ?? null;
}
