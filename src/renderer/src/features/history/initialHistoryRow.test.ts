import { describe, expect, it } from 'vitest';
import type { ItemHistory, ItemRevision } from '@shared/domain/history';
import { historyRows } from './historyRows';
import { initialHistoryRow } from './initialHistoryRow';

const revision = (changesetId: number, revisionId: number): ItemRevision => ({ changesetId, revisionId, itemType: 'file' }) as ItemRevision;

// Newest first; cs:9 moved the file without changing it.
const history: ItemHistory = {
  revisions: [revision(8, 80), revision(5, 50), revision(2, 20)],
  pathChanges: [{ changesetId: 9, owner: '', date: '', description: 'Moved from /a.ts to /b.ts' }],
  workspaceRevisionId: 50,
};
const rows = historyRows(history);
const open = (page: Omit<Parameters<typeof initialHistoryRow>[2], 'kind' | 'path'>) => initialHistoryRow(rows, history, { kind: 'history', path: 'b.ts', ...page });

describe('initialHistoryRow', () => {
  it('opens on the newest revision, not on a later move', () => {
    expect(open({})).toBe('8');
  });

  it('opens on the revision asked for, by changeset or by revision id', () => {
    expect(open({ select: { changesetId: 2 } })).toBe('2');
    expect(open({ select: { revisionId: 50 } })).toBe('5');
    expect(open({ select: { revisionId: 20 }, view: 'annotate' })).toBe('2');
  });

  it("annotates the workspace's revision unless told another", () => {
    expect(open({ view: 'annotate' })).toBe('5');
    expect(initialHistoryRow(rows, { ...history, workspaceRevisionId: undefined }, { kind: 'history', path: 'b.ts', view: 'annotate' })).toBe('8');
  });

  it("falls back when the revision asked for isn't in the history", () => {
    expect(open({ select: { revisionId: 99 } })).toBe('8');
    expect(open({ select: { revisionId: 99 }, view: 'annotate' })).toBe('5');
  });

  it('has nothing to open on without revisions', () => {
    expect(initialHistoryRow([], { revisions: [], pathChanges: [] }, { kind: 'history', path: 'b.ts' })).toBeNull();
  });
});
