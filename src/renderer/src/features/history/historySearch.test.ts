import { describe, expect, it } from 'vitest';
import type { ItemRevision } from '@shared/domain/history';
import { matchesRevisionSearch } from './revisionSearch';

const revision: ItemRevision = {
  revisionId: 7,
  changesetId: 42,
  branch: '/main/task-12',
  owner: 'jane.doe@example.com',
  date: '2026-01-01T10:00:00Z',
  comment: 'Fix the jump height\nLonger explanation',
  itemType: 'file',
  size: 100,
  spec: 'Player.cs#cs:42',
};

describe('matchesRevisionSearch', () => {
  it('matches everything when the search is blank', () => {
    expect(matchesRevisionSearch(revision, '  ')).toBe(true);
  });

  it.each(['42', 'JUMP', 'longer', 'task-12', 'jane.doe', 'Jane Doe'])('matches %s', (search) => {
    expect(matchesRevisionSearch(revision, search)).toBe(true);
  });

  it('rejects text found in no field', () => {
    expect(matchesRevisionSearch(revision, 'rocket')).toBe(false);
  });
});
