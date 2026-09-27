import { describe, expect, it } from 'vitest';
import { locksEmptyState } from './locksEmptyState';

describe('locksEmptyState', () => {
  it('explains lock rules only when nothing narrows the list', () => {
    expect(locksEmptyState({ searching: false, onlyMine: false })).toMatchObject({ title: 'Nothing is locked', offerEveryone: false });
    expect(locksEmptyState({ searching: true, onlyMine: false })).toEqual({
      title: 'No matching locks',
      description: 'No path or owner contains this text.',
      offerEveryone: false,
    });
  });

  it("offers everyone's locks when only the user's are shown", () => {
    expect(locksEmptyState({ searching: false, onlyMine: true })).toMatchObject({ title: 'You hold no locks', offerEveryone: true });
  });
});
