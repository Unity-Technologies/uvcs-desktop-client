import { describe, expect, it } from 'vitest';
import { graphSearchState, hitGoneTo, NO_SEARCH, type GraphSearchEvent, type GraphSearchState } from './graphSearchState';
import type { SearchHit } from './model/searchGraph';

const changeset = (id: number): SearchHit => ({ kind: 'changeset', id });
const HITS = [changeset(3), changeset(7), changeset(12)];

/** Plays the events in order from no search, and says each hit the graph went to on the way. */
function play(...events: GraphSearchEvent[]): { state: GraphSearchState; wentTo: (SearchHit | null)[] } {
  let state = NO_SEARCH;
  const wentTo: (SearchHit | null)[] = [];
  for (const event of events) {
    const next = graphSearchState(state, event);
    if (event.kind !== 'typed') wentTo.push(hitGoneTo(state, next, event.hits ?? []));
    state = next;
  }
  return { state, wentTo };
}

const typed = (value: string): GraphSearchEvent => ({ kind: 'typed', value });
const settled = (hits: readonly SearchHit[] | null): GraphSearchEvent => ({ kind: 'settled', hits });
const stepped = (direction: 1 | -1, hits: readonly SearchHit[]): GraphSearchEvent => ({ kind: 'stepped', direction, hits });

describe('graphSearchState', () => {
  it('goes to the first hit, as Next match would, once the typed query settles', () => {
    const { state, wentTo } = play(typed('cs'), typed('cs:'), typed('cs:7'), settled(HITS));
    expect(wentTo).toEqual([changeset(7)]);
    expect(state.activeHitIndex).toBe(1);
  });

  it('goes to the first hit from the left when no number is typed', () => {
    expect(play(typed('fix'), settled(HITS)).wentTo).toEqual([changeset(3)]);
  });

  it('counts each key as a new query, so a settle is only for the last one typed', () => {
    const { state } = play(typed('f'), typed('fi'), typed('fix'));
    expect(state.generation).toBe(3);
    expect(state.activeHitIndex).toBe(-1);
  });

  it('never goes on its own after Enter stepped before the pause', () => {
    const { wentTo } = play(typed('fix'), stepped(1, HITS), settled(HITS));
    expect(wentTo).toEqual([changeset(3), null]);
  });

  it('goes once per query: after it went, the hits changing or the user stepping never pull the view back', () => {
    const { state, wentTo } = play(typed('fix'), settled(HITS), stepped(1, HITS), settled([changeset(1), ...HITS]), settled(HITS));
    expect(wentTo).toEqual([changeset(3), changeset(7), null, null]);
    expect(state.activeHitIndex).toBe(1);
  });

  it('never moves the view for a cleared search', () => {
    const { state, wentTo } = play(typed('fix'), typed(''), settled([]));
    expect(wentTo).toEqual([null]);
    expect(state).toMatchObject({ text: '', activeHitIndex: -1, awaitingFirstHit: false });
    expect(play(typed('   '), settled(HITS)).wentTo).toEqual([null]);
  });

  it('goes again for the same query typed again', () => {
    const { wentTo } = play(typed('fix'), settled(HITS), typed('fi'), typed('fix'), settled(HITS));
    expect(wentTo).toEqual([changeset(3), changeset(3)]);
  });

  it('stops waiting when the query settles with no hits, so a later refresh that finds one never moves the view', () => {
    const { state, wentTo } = play(typed('nothing'), settled([]), settled(HITS));
    expect(wentTo).toEqual([null, null]);
    expect(state.awaitingFirstHit).toBe(false);
  });

  it('keeps waiting while the graph is not loaded, and goes once it is', () => {
    const { wentTo } = play(typed('fix'), settled(null), settled(HITS));
    expect(wentTo).toEqual([null, changeset(3)]);
  });

  it('steps round from one end to the other, Shift+Enter first landing on the last hit', () => {
    expect(play(typed('fix'), stepped(-1, HITS)).wentTo).toEqual([changeset(12)]);
    expect(play(typed('fix'), stepped(1, HITS), stepped(1, HITS), stepped(1, HITS), stepped(1, HITS)).wentTo).toEqual([changeset(3), changeset(7), changeset(12), changeset(3)]);
  });

  it('goes to the only hit again at each step', () => {
    expect(play(typed('cs:7'), settled([changeset(7)]), stepped(1, [changeset(7)])).wentTo).toEqual([changeset(7), changeset(7)]);
  });

  it('stays put when stepping finds nothing', () => {
    expect(play(typed('nothing'), stepped(1, [])).wentTo).toEqual([null]);
  });
});
