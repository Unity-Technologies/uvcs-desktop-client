import { describe, expect, it } from 'vitest';
import type { ConversationBlock } from './reviewRounds';
import { opensAtSince, roundChoiceForgotten, roundChosen, roundIsOpen, roundLineComment, roundVerdictOf } from './roundFolds';

const NONE: ReadonlyMap<number, boolean> = new Map();

/** The choices after clicking a round's line, as shown `open`. */
function click(chosen: ReadonlyMap<number, boolean>, round: { number: number; folds: boolean }, holdingPick?: number): Map<number, boolean> {
  return roundChosen(chosen, round.number, roundIsOpen(round, chosen, holdingPick));
}

describe('roundIsOpen', () => {
  const settled = { number: 1, folds: true };
  const withOpen = { number: 2, folds: false };

  it('starts a settled round folded and one with something open unfolded', () => {
    expect(roundIsOpen(settled, NONE, undefined)).toBe(false);
    expect(roundIsOpen(withOpen, NONE, undefined)).toBe(true);
  });

  it('turns a round over with each click on its line', () => {
    const once = click(NONE, settled);

    expect(roundIsOpen(settled, once, undefined)).toBe(true);
    expect(roundIsOpen(settled, click(once, settled), undefined)).toBe(false);
    expect(roundIsOpen(withOpen, click(NONE, withOpen), undefined)).toBe(false);
  });

  it('unfolds the round holding the thread gone to', () => {
    expect(roundIsOpen(settled, NONE, 1)).toBe(true);
  });

  it('still folds the round holding the thread gone to with a click on its line', () => {
    expect(roundIsOpen(settled, click(NONE, settled, 1), 1)).toBe(false);
    expect(roundIsOpen(withOpen, click(NONE, withOpen, 2), 2)).toBe(false);
  });

  it('keeps a round folded while it held the thread folded once the page goes to a thread elsewhere', () => {
    const held = { number: 2, folds: true };
    const folded = click(NONE, held, 2);

    expect(roundIsOpen(held, roundChoiceForgotten(folded, 3), 3)).toBe(false);
    expect(roundIsOpen(held, folded, undefined)).toBe(false);
  });
});

describe('roundChoiceForgotten', () => {
  it('unfolds a round folded by hand again when the page goes to a thread in it', () => {
    const folded = click(NONE, { number: 1, folds: false });

    expect(roundIsOpen({ number: 1, folds: false }, roundChoiceForgotten(folded, 1), 1)).toBe(true);
  });

  it("leaves the other rounds' choices as they were, and all of them when the thread is after every round", () => {
    const chosen = new Map([[1, true], [2, false]]);

    expect([...roundChoiceForgotten(chosen, 1)]).toEqual([[2, false]]);
    expect(roundChoiceForgotten(chosen, undefined)).toBe(chosen);
  });
});

describe('roundVerdictOf', () => {
  const round = { status: 'Reviewed' as const, date: '2026-11-09T16:40:00+01:00' };

  it("colors a folded round's mark by its status and dates it", () => {
    expect(roundVerdictOf(round, false)).toEqual({ colorOf: 'Reviewed', date: '2026-11-09T16:40:00+01:00' });
  });

  it("leaves an unfolded round's mark gray and undated: the status's own event says both", () => {
    expect(roundVerdictOf(round, true)).toEqual({});
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
