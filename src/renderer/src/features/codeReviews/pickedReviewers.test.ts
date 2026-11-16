import { describe, expect, it } from 'vitest';
import { NO_REVIEWERS, pickedReviewersOf, reviewersToAsk } from './pickedReviewers';
import { togglePicked } from './reviewerPick';

describe('pickedReviewersOf', () => {
  it('shows nobody, and no Remove all, before anyone is picked', () => {
    expect(pickedReviewersOf(NO_REVIEWERS)).toEqual({ chips: [], removeAll: false });
  });

  it('names each reviewer in the order picked: a user by the name shown for them, a group as the server names it', () => {
    const pick = togglePicked(togglePicked(NO_REVIEWERS, { name: 'jane.doe@acme.com', kind: 'user' }), { name: 'Developers', kind: 'group' });
    expect(pickedReviewersOf(pick).chips).toEqual([
      { name: 'jane.doe@acme.com', label: 'Jane Doe', group: false },
      { name: 'Developers', label: 'Developers', group: true },
    ]);
  });

  it('offers Remove all once several are picked', () => {
    const one = togglePicked(NO_REVIEWERS, { name: 'ana', kind: 'user' });
    expect(pickedReviewersOf(one).removeAll).toBe(false);
    expect(pickedReviewersOf(togglePicked(one, { name: 'Developers', kind: 'group' })).removeAll).toBe(true);
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
