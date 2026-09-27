import { describe, expect, it } from 'vitest';
import type { ItemRevision } from '@shared/domain/history';
import { revisionBefore } from './revisionBefore';

const revision = (changesetId: number): ItemRevision => ({
  revisionId: changesetId * 10,
  changesetId,
  branch: '/main',
  owner: 'jane@example.com',
  date: '2026-01-01T10:00:00Z',
  comment: '',
  itemType: 'file',
  size: 1,
  spec: `a.cs#cs:${changesetId}`,
  idSpec: `revid:${changesetId * 10}@game@local`,
});

const history = [revision(30), revision(12), revision(5)];

describe('revisionBefore', () => {
  it('finds the revision right before the changeset', () => {
    expect(revisionBefore(history, 30)?.changesetId).toBe(12);
  });

  it('works for changesets that are not in the history, like merges', () => {
    expect(revisionBefore(history, 20)?.changesetId).toBe(12);
  });

  it('finds nothing before the revision that added the file', () => {
    expect(revisionBefore(history, 5)).toBeUndefined();
  });
});
