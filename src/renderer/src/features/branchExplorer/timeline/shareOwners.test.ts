import { describe, expect, it } from 'vitest';
import { EVERYONE, MINE } from '../../../lib/peopleFilter';
import { shareOwners } from './shareOwners';

describe('shareOwners', () => {
  it("is the user's own changesets with everyone shown, or Mine picked", () => {
    expect(shareOwners(EVERYONE, 'me@example.com')).toEqual({ owners: new Set(['me@example.com']), word: 'yours' });
    expect(shareOwners(MINE, 'me@example.com')).toEqual({ owners: new Set(['me@example.com']), word: 'yours' });
  });

  it('is the people picked when they are others, one of them by name', () => {
    expect(shareOwners({ mine: true, others: ['ana'] }, 'me@example.com')).toEqual({ owners: new Set(['ana', 'me@example.com']), word: 'by the people picked' });
    expect(shareOwners({ mine: false, others: ['ana', 'bob'] }, 'me@example.com')).toEqual({ owners: new Set(['ana', 'bob']), word: 'by the people picked' });
    expect(shareOwners({ mine: false, others: ['ana'] }, 'me@example.com')).toEqual({ owners: new Set(['ana']), word: 'by ana' });
  });

  it('is nobody while the user’s name is still being read', () => {
    expect(shareOwners(EVERYONE, undefined)).toEqual({ owners: new Set(), word: 'yours' });
  });
});
