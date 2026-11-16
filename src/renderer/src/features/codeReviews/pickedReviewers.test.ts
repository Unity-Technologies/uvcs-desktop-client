import { describe, expect, it } from 'vitest';
import { chooseReviewers, focusAfterRemoving, NO_REVIEWERS, pickAsPickerOpens, pickedReviewersOf, reviewersShown, reviewersToAsk, startingReviewers } from './pickedReviewers';
import { pickOffered, togglePicked } from './reviewerPick';

describe('pickedReviewersOf', () => {
  it('shows nobody, no Remove all, and the hint that reviewers are optional, before anyone is picked', () => {
    expect(pickedReviewersOf(NO_REVIEWERS)).toEqual({ chips: [], removeAll: false, hint: true });
  });

  it('names each reviewer in the order picked: a user by the name shown for them, a group as the server names it', () => {
    const jane = { name: 'jane.doe@acme.com', kind: 'user' } as const;
    const developers = { name: 'Developers', kind: 'group' } as const;
    expect(pickedReviewersOf(togglePicked(togglePicked(NO_REVIEWERS, jane), developers))).toEqual({
      chips: [
        { member: jane, label: 'Jane Doe', group: false, tip: 'jane.doe@acme.com' },
        { member: developers, label: 'Developers', group: true },
      ],
      removeAll: true,
      hint: false,
    });
  });

  it("tells a user's email under the pointer only when the chip shows another name", () => {
    expect(pickedReviewersOf(togglePicked(NO_REVIEWERS, { name: 'ana', kind: 'user' })).chips[0].tip).toBeUndefined();
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

  it('moves to the button that opens the picker once the last chip, or the only one, is removed', () => {
    expect(focusAfterRemoving(2, 3)).toBe('picker');
    expect(focusAfterRemoving(0, 1)).toBe('picker');
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

// The list doesn't move under the pointer: who was picked as it opened leads it, and checking someone else leaves them
// where they are.
describe('pickAsPickerOpens', () => {
  const members = { users: ['ana', 'bob', 'carol'], groups: ['Developers'] };

  it('lists those already picked first, checked', () => {
    const pick = pickAsPickerOpens(togglePicked(NO_REVIEWERS, { name: 'carol', kind: 'user' }));
    expect(pickOffered(pick, members)[0]).toBe('carol');
    expect(pick.picked).toEqual([{ name: 'carol', kind: 'user' }]);
  });

  it('keeps the order while the user checks and unchecks', () => {
    const opened = pickAsPickerOpens(togglePicked(NO_REVIEWERS, { name: 'carol', kind: 'user' }));
    const before = pickOffered(opened, members);
    const checked = togglePicked(togglePicked(opened, { name: 'ana', kind: 'user' }), { name: 'carol', kind: 'user' });
    expect(pickOffered(checked, members)).toEqual(before);
  });

  it('asks the same reviewers it was given', () => {
    const pick = togglePicked(NO_REVIEWERS, { name: 'QA', kind: 'group' });
    expect(reviewersToAsk(pickAsPickerOpens(pick))).toEqual(reviewersToAsk(pick));
  });
});

describe('startingReviewers', () => {
  it("asks you when the branch is someone else's", () => {
    expect(startingReviewers('ana@acme.com', 'bob@acme.com')).toEqual({ onOpen: [], picked: [{ name: 'ana@acme.com', kind: 'user' }] });
  });

  it('asks nobody on a branch of your own, whatever the case of the names', () => {
    expect(startingReviewers('ana@acme.com', 'Ana@Acme.com')).toEqual(NO_REVIEWERS);
  });

  it('asks nobody while you or the owner are still read', () => {
    expect(startingReviewers(undefined, 'bob@acme.com')).toEqual(NO_REVIEWERS);
    expect(startingReviewers('ana@acme.com', undefined)).toEqual(NO_REVIEWERS);
  });
});

describe('reviewersShown and chooseReviewers', () => {
  const you = { name: 'ana@acme.com', kind: 'user' } as const;
  const jane = { name: 'jane.doe@acme.com', kind: 'user' } as const;
  const onSomeoneElses = startingReviewers('ana@acme.com', 'bob@acme.com');

  it('follow the branch picked until the user changes who is asked', () => {
    expect(reviewersShown(undefined, onSomeoneElses)).toEqual(onSomeoneElses);
    expect(reviewersShown(undefined, NO_REVIEWERS)).toEqual(NO_REVIEWERS);
  });

  it('keep following the branch when the picker only opened, its order kept, even before the owner was read', () => {
    const opened = chooseReviewers(undefined, NO_REVIEWERS, pickAsPickerOpens(NO_REVIEWERS));
    expect(reviewersShown(opened, onSomeoneElses).picked).toEqual([you]);
    const openedOnYou = chooseReviewers(undefined, onSomeoneElses, pickAsPickerOpens(onSomeoneElses));
    expect(reviewersShown(openedOnYou, NO_REVIEWERS)).toEqual({ onOpen: [you], picked: [] });
  });

  it('stop following the branch once someone is checked or unchecked, even when the user puts the same reviewers back later', () => {
    const checked = chooseReviewers(undefined, NO_REVIEWERS, togglePicked(NO_REVIEWERS, jane));
    expect(reviewersShown(checked, onSomeoneElses).picked).toEqual([jane]);
    const back = chooseReviewers(checked, NO_REVIEWERS, NO_REVIEWERS);
    expect(reviewersShown(back, onSomeoneElses)).toEqual(NO_REVIEWERS);
  });
});
