import { describe, expect, it } from 'vitest';
import type { ItemPathChange, ItemRevision } from '@shared/domain/history';
import { historyRowKey, historyRows, ownerOf, revisionRowKey } from './historyRows';

const revision = (changesetId: number): ItemRevision => ({
  revisionId: changesetId * 10,
  parentRevisionId: -1,
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
const change = (changesetId: number): ItemPathChange => ({ changesetId, owner: 'jane@example.com', date: '', description: 'Moved from /b.cs to /a.cs' });

describe('historyRows', () => {
  it('interleaves moves with the revisions, newest first, a move below the revision of its changeset', () => {
    const rows = historyRows({ revisions: [revision(9), revision(5), revision(1)], pathChanges: [change(7), change(5)] });
    expect(rows.map(historyRowKey)).toEqual(['9', '7-path', '5', '5-path', '1']);
  });
});

describe('revisionRowKey', () => {
  const rows = historyRows({ revisions: [revision(9), revision(1)], pathChanges: [change(7)] });

  it("finds the row of a changeset's revision", () => {
    expect(revisionRowKey(rows, 9)).toBe('9');
  });

  it('finds none for a changeset that only moved the item, or never touched it', () => {
    expect(revisionRowKey(rows, 7)).toBeNull();
    expect(revisionRowKey(rows, 4)).toBeNull();
  });
});

describe('ownerOf', () => {
  it('names who made a revision or a move', () => {
    expect(ownerOf({ kind: 'revision', revision: { ...revision(3), owner: 'ana' } })).toBe('ana');
    expect(ownerOf({ kind: 'pathChange', change: { ...change(4), owner: 'bob' } })).toBe('bob');
  });
});
