import { describe, expect, it } from 'vitest';
import { focusAfterRemoving, NO_REVIEWERS, pickedReviewersOf, reviewersToAsk } from './pickedReviewers';
import { togglePicked } from './reviewerPick';

describe('pickedReviewersOf', () => {
  it('shows nobody, no Remove all, and the hint that reviewers are optional, before anyone is picked', () => {
    expect(pickedReviewersOf(NO_REVIEWERS)).toEqual({ chips: [], removeAll: false, hint: true });
  });

  it('names each reviewer in the order picked: a user by the name shown for them, a group as the server names it', () => {
    const jane = { name: 'jane.doe@acme.com', kind: 'user' } as const;
    const developers = { name: 'Developers', kind: 'group' } as const;
    expect(pickedReviewersOf(togglePicked(togglePicked(NO_REVIEWERS, jane), developers))).toEqual({
      chips: [
        { member: jane, label: 'Jane Doe', group: false },
        { member: developers, label: 'Developers', group: true },
      ],
      removeAll: true,
      hint: false,
    });
  });

  it('offers Remove all once several are picked', () => {
    const one = togglePicked(NO_REVIEWERS, { name: 'ana', kind: 'user' });
    expect(pickedReviewersOf(one).removeAll).toBe(false);
    expect(pickedReviewersOf(togglePicked(one, { name: 'Developers', kind: 'group' })).removeAll).toBe(true);
  });
});

// The keyboard never falls out of the field when a chip goes: it lands where the removed chip's × was.
describe('focusAfterRemoving', () => {
  it("moves to the next chip's ×, the one that takes the removed chip's place", () => {
    expect(focusAfterRemoving(0, 3)).toBe(0);
    expect(focusAfterRemoving(1, 3)).toBe(1);
  });

  it('moves to Add once the last chip, or the only one, is removed', () => {
    expect(focusAfterRemoving(2, 3)).toBe('add');
    expect(focusAfterRemoving(0, 1)).toBe('add');
  });
});

describe('reviewersToAsk', () => {
  // A group the picker learned by a search stays a group, whatever the server's group list says by then.
  it('asks each reviewer picked, as the kind they were listed with', () => {
    const pick = togglePicked(togglePicked(NO_REVIEWERS, { name: 'ana', kind: 'user' }), { name: 'QA', kind: 'group' });
    expect(reviewersToAsk(pick)).toEqual([
      { name: 'ana', kind: 'user' },
      { name: 'QA', kind: 'group' },
    ]);
  });

  it('asks nobody once a reviewer picked is taken off again', () => {
    const ana = { name: 'ana', kind: 'user' } as const;
    expect(reviewersToAsk(togglePicked(togglePicked(NO_REVIEWERS, ana), ana))).toEqual([]);
  });
});
