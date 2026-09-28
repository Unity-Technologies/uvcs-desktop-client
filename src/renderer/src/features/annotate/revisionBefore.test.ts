import { describe, expect, it } from 'vitest';
import type { ItemRevision } from '@shared/domain/history';
import { revisionBefore } from './revisionBefore';

const revision = (changesetId: number, parentChangeset: number | null): ItemRevision => ({
  revisionId: changesetId * 10,
  parentRevisionId: parentChangeset === null ? -1 : parentChangeset * 10,
  changesetId,
  branch: '/main',
  owner: 'jane@example.com',
  date: '2026-01-01T10:00:00Z',
  comment: '',
  itemType: 'file',
  size: 1,
  repository: 'game@local',
  idSpec: `revid:${changesetId * 10}@game@local`,
});

// cs:30 on /main was made from cs:5; cs:12 is a task branch's.
const history = [revision(30, 5), revision(12, 5), revision(5, null)];

describe('revisionBefore', () => {
  it('finds the revision the changeset changed, not the one listed before it', () => {
    expect(revisionBefore(history, 30)?.changesetId).toBe(5);
  });

  it('works for changesets that are not in the history, like merges', () => {
    expect(revisionBefore(history, 20)?.changesetId).toBe(12);
  });

  it('finds nothing before the revision that added the file', () => {
    expect(revisionBefore(history, 5)).toBeUndefined();
  });
});
