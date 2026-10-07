import { describe, expect, it } from 'vitest';
import type { BranchIncoming, BranchIncomingChanges } from '@shared/domain/incoming';
import { nextProgressBar, SWEEP } from '../../app/operations/progressBar';
import { chipReadsIncomingChanges, incomingChipState } from './incomingChipState';

const summary = (changesetCount: number, countCapped = false): BranchIncoming => ({
  branch: '/main',
  loadedChangeset: 10,
  headChangeset: 10 + changesetCount,
  changesetCount,
  countCapped,
  authors: [],
});
const changes = (conflicts: number, blocked = 0, headChangeset = 13): BranchIncomingChanges => ({
  ...summary(3),
  moreChangesets: false,
  headChangeset,
  changesets: [],
  files: [],
  conflicts: Array.from({ length: conflicts }, (_, index) => ({ path: `f${index}`, isBinary: false, baseRevisionId: 1, incomingRevisionId: 2, repository: 'game@local' })),
  blockedPaths: Array.from({ length: blocked }, (_, index) => `b${index}`),
});

describe('incomingChipState', () => {
  it('shows nothing when up to date or not on a branch', () => {
    expect(incomingChipState(summary(0), undefined, undefined)).toBeNull();
    expect(incomingChipState({ branch: null, changesetCount: 0, countCapped: false, authors: [] }, undefined, undefined)).toBeNull();
    expect(incomingChipState(undefined, undefined, undefined)).toBeNull();
  });

  it('offers the new changesets once they are known not to collide with local changes', () => {
    expect(incomingChipState(summary(3), undefined, undefined)).toEqual({ kind: 'incoming', branch: '/main', count: 3, countCapped: false, checked: false });
    expect(incomingChipState(summary(3), changes(0), undefined)).toEqual({ kind: 'incoming', branch: '/main', count: 3, countCapped: false, checked: true });
  });

  it('counts files changed on both sides, and local changes the branch deleted or moved, as conflicts', () => {
    expect(incomingChipState(summary(3), changes(2, 1), undefined)).toEqual({
      kind: 'conflicts',
      branch: '/main',
      count: 3,
      countCapped: false,
      conflictCount: 3,
      mergeCount: 2,
      blockedCount: 1,
    });
  });

  it('ignores changes read for an older head', () => {
    expect(incomingChipState(summary(3), changes(2, 0, 12), undefined)).toEqual({ kind: 'incoming', branch: '/main', count: 3, countCapped: false, checked: false });
  });

  it('carries a count the check stopped at', () => {
    expect(incomingChipState(summary(100, true), undefined, undefined)).toEqual({ kind: 'incoming', branch: '/main', count: 100, countCapped: true, checked: false });
  });

  it('shows the stage of a running update, even when nothing was incoming', () => {
    const progress = { stage: 'downloading' as const, stageLabel: 'Downloading', current: 1, total: 4, bytesDone: 1024, bytesTotal: 4096, fraction: 0.25 };
    const running = { id: '1', workspacePath: '/w', kind: 'update' as const, title: 'Updating workspace', progress, bar: nextProgressBar(SWEEP, progress, 0) };
    expect(incomingChipState(summary(0), undefined, running)).toEqual({ kind: 'updating', stage: '25% · 1 of 4 files', ring: 0.25 });
    expect(incomingChipState(summary(3), undefined, { ...running, progress: null, bar: SWEEP })).toEqual({ kind: 'updating', stage: 'Starting', ring: null });
  });

  it('ignores other operations', () => {
    const running = { id: '1', workspacePath: '/w', kind: 'switch' as const, title: 'Switching to /main/task', progress: null, bar: SWEEP };
    expect(incomingChipState(summary(0), undefined, running)).toBeNull();
  });
});

describe('chipReadsIncomingChanges', () => {
  it('reads what collides up front while the check counted every changeset, to warn about conflicts without a hover', () => {
    expect(chipReadsIncomingChanges(summary(3), false)).toBe(true);
    expect(chipReadsIncomingChanges(summary(99), false)).toBe(true);
  });

  it('waits for the card to open once the check stopped counting: the diff of that many changesets is a heavy read', () => {
    expect(chipReadsIncomingChanges(summary(100, true), false)).toBe(false);
    expect(chipReadsIncomingChanges(summary(100, true), true)).toBe(true);
  });

  it('reads nothing when nothing came in', () => {
    expect(chipReadsIncomingChanges(summary(0), true)).toBe(false);
    expect(chipReadsIncomingChanges(undefined, true)).toBe(false);
  });
});
