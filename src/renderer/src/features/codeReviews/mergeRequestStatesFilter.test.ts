import { describe, expect, it } from 'vitest';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { EVERY_STATE, isOnlyState, matchesStates, restoredStates, serverStateOf, statesChipLabel, STILL_TO_MERGE, toggledState } from './mergeRequestStatesFilter';

describe('ticking the State chip', () => {
  it('adds and removes a state, keeping the order a merge request goes in', () => {
    expect(toggledState(['Open'], 'Closed')).toEqual(['Open', 'Closed']);
    expect(toggledState(['Open', 'Closed'], 'Draft')).toEqual(['Draft', 'Open', 'Closed']);
    expect(toggledState(STILL_TO_MERGE, 'Draft')).toEqual(['Open']);
  });

  it('keeps the last state ticked, which the menu shows disabled', () => {
    expect(toggledState(['Merged'], 'Merged')).toEqual(['Merged']);
    expect([isOnlyState(['Merged'], 'Merged'), isOnlyState(['Merged'], 'Open'), isOnlyState(STILL_TO_MERGE, 'Open')]).toEqual([true, false, false]);
  });
});

describe("the State chip's label", () => {
  it('names one state, joins several as a sentence, and says Any state with all four', () => {
    expect(statesChipLabel(['Merged'])).toBe('Merged');
    expect(statesChipLabel(STILL_TO_MERGE)).toBe('Draft or open');
    expect(statesChipLabel(['Draft', 'Open', 'Closed'])).toBe('Draft, open or closed');
    expect(statesChipLabel(EVERY_STATE)).toBe('Any state');
  });
});

describe('what the server is asked for', () => {
  it('asks for Merged or Closed alone, and for no state otherwise, narrowed locally', () => {
    expect([serverStateOf(['Merged']), serverStateOf(['Closed'])]).toEqual(['Merged', 'Closed']);
    // Draft or Open alone keeps the code reviews, which a state asked of the server would leave out.
    expect([serverStateOf(['Draft']), serverStateOf(['Open']), serverStateOf(['Merged', 'Closed']), serverStateOf(STILL_TO_MERGE), serverStateOf(EVERY_STATE)]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });
});

describe('which reviews show', () => {
  const plain = codeReviewSummary({ id: 1 });
  const of = (state: 'Draft' | 'Open' | 'Merged' | 'Closed', id: number) => codeReviewSummary({ id, mergeRequest: { state, destination: '/main' } });
  const all = [plain, of('Draft', 2), of('Open', 3), of('Merged', 4), of('Closed', 5)];
  const kept = (states: Parameters<typeof matchesStates>[1]) => all.filter((review) => matchesStates(review, states)).map((review) => review.id);

  it('keeps the code reviews and the merge requests still to merge at rest', () => {
    expect(kept(STILL_TO_MERGE)).toEqual([1, 2, 3]);
  });

  it('keeps the merge requests in a state ticked, and the code reviews while Draft or Open is', () => {
    expect(kept(['Draft'])).toEqual([1, 2]);
    expect(kept(['Open', 'Merged'])).toEqual([1, 3, 4]);
    expect(kept(['Merged', 'Closed'])).toEqual([4, 5]);
    expect(kept(EVERY_STATE)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('the states remembered', () => {
  it("reads an older version's one choice as the states it showed", () => {
    expect([restoredStates('active'), restoredStates('all'), restoredStates('merged'), restoredStates('closed')]).toEqual([STILL_TO_MERGE, EVERY_STATE, ['Merged'], ['Closed']]);
  });

  it('keeps the known states of a list in order, and rests on anything else', () => {
    expect(restoredStates(['Closed', 'Open', 'Gone'])).toEqual(['Open', 'Closed']);
    expect([restoredStates([]), restoredStates(['Gone']), restoredStates(undefined), restoredStates('other'), restoredStates(3)]).toEqual([
      STILL_TO_MERGE,
      STILL_TO_MERGE,
      STILL_TO_MERGE,
      STILL_TO_MERGE,
      STILL_TO_MERGE,
    ]);
  });
});
