import { describe, expect, it } from 'vitest';
import { EVERYONE, MINE } from '../../../lib/peopleFilter';
import { shareOwners } from './shareOwners';

describe('shareOwners', () => {
  it("is the user's own changesets with everyone shown, or Mine picked", () => {
    expect(shareOwners(EVERYONE, 'me@example.com')).toEqual({ owners: new Set(['me@example.com']), isMine: true });
    expect(shareOwners(MINE, 'me@example.com')).toEqual({ owners: new Set(['me@example.com']), isMine: true });
  });

  it('is the people picked when they are others', () => {
    expect(shareOwners({ mine: true, others: ['ana'] }, 'me@example.com')).toEqual({ owners: new Set(['ana', 'me@example.com']), isMine: false });
    expect(shareOwners({ mine: false, others: ['ana'] }, 'me@example.com')).toEqual({ owners: new Set(['ana']), isMine: false });
  });

  it('is nobody while the user’s name is still being read', () => {
    expect(shareOwners(EVERYONE, undefined)).toEqual({ owners: new Set(), isMine: true });
  });
});
