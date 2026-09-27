import { describe, expect, it } from 'vitest';
import { shelvesEmptyState } from './shelvesEmptyState';

describe('shelvesEmptyState', () => {
  it('tells a filter that matches nothing from having no shelves', () => {
    expect(shelvesEmptyState({ searching: true, onlyMine: true })).toMatchObject({ title: 'No matching shelves', offerEveryone: false });
    expect(shelvesEmptyState({ searching: false, onlyMine: false })).toMatchObject({ title: 'No shelves', offerEveryone: false });
  });

  it("offers everyone's shelves when only the user's are shown", () => {
    expect(shelvesEmptyState({ searching: false, onlyMine: true })).toMatchObject({ title: 'You have no shelves', offerEveryone: true });
  });
});
