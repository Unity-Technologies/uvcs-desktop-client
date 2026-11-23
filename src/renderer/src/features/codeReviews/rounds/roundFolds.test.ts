import { describe, expect, it } from 'vitest';
import type { ConversationBlock } from './reviewRounds';
import { opensAtSince, roundIsOpen, roundLineComment, toggledRound, untoggledRound } from './roundFolds';

describe('roundIsOpen', () => {
  it('starts a settled round folded and one with something open unfolded', () => {
    expect(roundIsOpen({ number: 1, folds: true }, new Set(), undefined)).toBe(false);
    expect(roundIsOpen({ number: 2, folds: false }, new Set(), undefined)).toBe(true);
  });

  it('turns a round over with each click on its line', () => {
    const once = toggledRound(new Set(), 1);

    expect(roundIsOpen({ number: 1, folds: true }, once, undefined)).toBe(true);
    expect(roundIsOpen({ number: 1, folds: true }, toggledRound(once, 1), undefined)).toBe(false);
    expect(roundIsOpen({ number: 2, folds: false }, toggledRound(new Set(), 2), undefined)).toBe(false);
  });

  it('unfolds the round holding the thread gone to', () => {
    expect(roundIsOpen({ number: 1, folds: true }, new Set(), 1)).toBe(true);
  });

  it('still folds the round holding the thread gone to with a click on its line', () => {
    expect(roundIsOpen({ number: 1, folds: true }, toggledRound(new Set(), 1), 1)).toBe(false);
    expect(roundIsOpen({ number: 2, folds: false }, toggledRound(new Set(), 2), 2)).toBe(false);
  });
});

describe('untoggledRound', () => {
  it('unfolds a round folded by hand again when the page goes to a thread in it', () => {
    const folded = toggledRound(new Set(), 1);
    const goneTo = untoggledRound(folded, 1);

    expect(roundIsOpen({ number: 1, folds: true }, goneTo, 1)).toBe(true);
  });

  it("leaves the other rounds' clicks as they were, and all of them when the thread is after every round", () => {
    const toggled = toggledRound(toggledRound(new Set(), 1), 2);

    expect([...untoggledRound(toggled, 1)]).toEqual([2]);
    expect(untoggledRound(toggled, undefined)).toBe(toggled);
  });
});

describe('roundLineComment', () => {
  it("shows what the reviewer said under a folded round's line", () => {
    expect(roundLineComment({ comment: 'Reviewed head 1acd180c' }, false)).toBe('Reviewed head 1acd180c');
  });

  it('leaves it to the status event of an unfolded round, and says nothing for a status given with none', () => {
    expect(roundLineComment({ comment: 'Reviewed head 1acd180c' }, true)).toBeUndefined();
    expect(roundLineComment({ comment: '  ' }, false)).toBeUndefined();
  });
});

describe('opensAtSince', () => {
  const since: ConversationBlock = { kind: 'since', date: '2026-11-09T16:40:00+01:00' };

  it('opens at the line when there is one', () => {
    expect(opensAtSince([since], undefined)).toBe(true);
    expect(opensAtSince([], undefined)).toBe(false);
  });

  it('goes to the thread the page was opened at instead', () => {
    expect(opensAtSince([since], 42)).toBe(false);
  });
});
