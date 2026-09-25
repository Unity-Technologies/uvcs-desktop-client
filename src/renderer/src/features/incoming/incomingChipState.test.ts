import { describe, expect, it } from 'vitest';
import type { IncomingChanges, IncomingSummary } from '@shared/domain/incoming';
import { incomingChipState } from './incomingChipState';

const summary = (changesetCount: number, branch: string | null = '/main'): IncomingSummary => ({
  branch,
  loadedChangeset: 10,
  headChangeset: 10 + changesetCount,
  changesetCount,
  authors: [],
});
const changes = (conflicts: number, blocked = 0, headChangeset = 13): IncomingChanges => ({
  ...summary(3),
  headChangeset,
  changesets: [],
  files: [],
  conflicts: Array.from({ length: conflicts }, (_, index) => ({ path: `f${index}`, isBinary: false, baseRevisionId: 1, incomingRevisionId: 2 })),
  blockedPaths: Array.from({ length: blocked }, (_, index) => `b${index}`),
});

describe('incomingChipState', () => {
  it('shows nothing when up to date or not on a branch', () => {
    expect(incomingChipState(summary(0), undefined, undefined)).toBeNull();
    expect(incomingChipState(summary(3, null), undefined, undefined)).toBeNull();
    expect(incomingChipState(undefined, undefined, undefined)).toBeNull();
  });

  it('offers the new changesets once they are known not to collide with local changes', () => {
    expect(incomingChipState(summary(3), undefined, undefined)).toEqual({ kind: 'incoming', branch: '/main', count: 3, checked: false });
    expect(incomingChipState(summary(3), changes(0), undefined)).toEqual({ kind: 'incoming', branch: '/main', count: 3, checked: true });
  });

  it('counts files changed on both sides, and local changes the branch deleted or moved, as conflicts', () => {
    expect(incomingChipState(summary(3), changes(2, 1), undefined)).toEqual({ kind: 'conflicts', branch: '/main', count: 3, conflictCount: 3 });
  });

  it('ignores changes read for an older head', () => {
    expect(incomingChipState(summary(3), changes(2, 0, 12), undefined)).toEqual({ kind: 'incoming', branch: '/main', count: 3, checked: false });
  });

  it('shows the stage of a running update, even when nothing was incoming', () => {
    const running = { id: '1', workspacePath: '/w', kind: 'update' as const, title: 'Updating workspace', detail: 'Creating f1.bin' };
    expect(incomingChipState(summary(0), undefined, running)).toEqual({ kind: 'updating', stage: 'Creating f1.bin' });
    expect(incomingChipState(summary(3), undefined, { ...running, detail: null })).toEqual({ kind: 'updating', stage: 'Starting' });
  });

  it('ignores other operations', () => {
    const running = { id: '1', workspacePath: '/w', kind: 'switch' as const, title: 'Switching to /main/task', detail: null };
    expect(incomingChipState(summary(0), undefined, running)).toBeNull();
  });
});
