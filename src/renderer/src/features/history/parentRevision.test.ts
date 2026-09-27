import { describe, expect, it } from 'vitest';
import type { ItemRevision } from '@shared/domain/history';
import { parentRevision } from './parentRevision';

const revision = (changesetId: number, parentRevisionId: number): ItemRevision => ({
  revisionId: changesetId * 10,
  parentRevisionId,
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

describe('parentRevision', () => {
  // cs:9 on a task branch was made from cs:3; cs:7 is another branch's.
  const history = [revision(9, 30), revision(7, 30), revision(3, 10), revision(1, -1)];

  it('is the revision it was made from, not the one listed below it', () => {
    expect(parentRevision(history, history[0]!)?.changesetId).toBe(3);
  });

  it('is none for the revision that added the item', () => {
    expect(parentRevision(history, history[3]!)).toBeUndefined();
  });

  it('falls back to the revision below when the parent is not listed', () => {
    expect(parentRevision([revision(9, 999), revision(7, 30)], revision(9, 999))?.changesetId).toBe(7);
  });
});
