import { describe, expect, it } from 'vitest';
import type { MergeRequestState } from '@shared/domain/codeReview';
import { checksConflicts, conflictsCheckOf, readsDestinationHead, runsConflictsCheck, type ConflictsCheckRun } from './mergeRequestConflicts';

const run = (more: Partial<ConflictsCheckRun> = {}): ConflictsCheckRun => ({
  state: 'Open',
  inWorkspace: true,
  sourceHead: 12,
  tabShown: true,
  asked: true,
  destinationHead: 30,
  ...more,
});

describe('checksConflicts', () => {
  it('is for an open request only', () => {
    const states: MergeRequestState[] = ['Draft', 'Open', 'Merged', 'Closed'];
    expect(states.filter((state) => checksConflicts(run({ state })))).toEqual(['Open']);
  });

  it('is for a window with a workspace only: the preview runs in one', () => {
    expect(checksConflicts(run({ inWorkspace: false }))).toBe(false);
  });

  it("waits for the branch's changesets, and is never for a branch with none: nothing to merge", () => {
    expect(checksConflicts(run({ sourceHead: undefined }))).toBe(false);
  });
});

describe('readsDestinationHead', () => {
  it('reads the destination only once asked, while the conversation is shown', () => {
    expect(readsDestinationHead(run())).toBe(true);
    expect(readsDestinationHead(run({ asked: false }))).toBe(false);
    expect(readsDestinationHead(run({ tabShown: false }))).toBe(false);
    expect(readsDestinationHead(run({ state: 'Draft' }))).toBe(false);
  });
});

describe('runsConflictsCheck', () => {
  it('runs once asked, on an open request, its conversation shown, in a workspace, both heads known', () => {
    expect(runsConflictsCheck(run())).toBe(true);
  });

  it('runs nothing unasked: it takes the server over a second on a big repository', () => {
    expect(runsConflictsCheck(run({ asked: false }))).toBe(false);
  });

  it('runs nothing while the Changes tab is shown, nor on a request that is not open', () => {
    expect(runsConflictsCheck(run({ tabShown: false }))).toBe(false);
    expect(runsConflictsCheck(run({ state: 'Merged' }))).toBe(false);
    expect(runsConflictsCheck(run({ state: 'Closed' }))).toBe(false);
    expect(runsConflictsCheck(run({ state: 'Draft' }))).toBe(false);
  });

  it('runs nothing in a window with no workspace', () => {
    expect(runsConflictsCheck(run({ inWorkspace: false }))).toBe(false);
  });

  it('waits for both heads, which key it', () => {
    expect(runsConflictsCheck(run({ sourceHead: undefined }))).toBe(false);
    expect(runsConflictsCheck(run({ destinationHead: undefined }))).toBe(false);
  });
});

describe('conflictsCheckOf', () => {
  const counts = { status: 'ready', files: 2, directories: 0 } as const;

  it('offers to check before it is asked', () => {
    expect(conflictsCheckOf({ asked: false, failed: false })).toEqual({ kind: 'unchecked' });
  });

  it('is checking once asked, until the answer comes', () => {
    expect(conflictsCheckOf({ asked: true, failed: false })).toEqual({ kind: 'checking' });
  });

  it('shows the answer, also one kept from an earlier check of the same heads, unasked', () => {
    expect(conflictsCheckOf({ asked: true, counts, failed: false })).toEqual({ kind: 'checked', counts });
    expect(conflictsCheckOf({ asked: false, counts, failed: false })).toEqual({ kind: 'checked', counts });
  });

  it('fails when the preview or the read of the destination failed', () => {
    expect(conflictsCheckOf({ asked: true, failed: true })).toEqual({ kind: 'failed' });
  });
});
