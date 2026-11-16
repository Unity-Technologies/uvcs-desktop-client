import { describe, expect, it } from 'vitest';
import type { MergeRequestState } from '@shared/domain/codeReview';
import { checksConflicts, conflictsCheckOf, conflictsCheckRequest, readsDestinationHead, type ConflictsCheckAnswer, type ConflictsCheckRun } from './mergeRequestConflicts';

const run = (more: Partial<ConflictsCheckRun> = {}): ConflictsCheckRun => ({
  state: 'Open',
  workspacePath: '/work',
  source: '/main/task',
  destination: '/main',
  sourceHead: 12,
  tabShown: true,
  asked: true,
  destinationRead: true,
  destinationHead: 30,
  ...more,
});

describe('checksConflicts', () => {
  it('is for an open request only', () => {
    const states: MergeRequestState[] = ['Draft', 'Open', 'Merged', 'Closed'];
    expect(states.filter((state) => checksConflicts(run({ state })))).toEqual(['Open']);
  });

  it('is for a window with a workspace only: the preview runs in one', () => {
    expect(checksConflicts(run({ workspacePath: null }))).toBe(false);
  });

  it("is for a request whose branch is named: one whose name couldn't be read has none", () => {
    expect(checksConflicts(run({ source: undefined }))).toBe(false);
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

describe('conflictsCheckRequest', () => {
  it('runs once asked, on an open request, its conversation shown, in a workspace, both heads known', () => {
    expect(conflictsCheckRequest(run())).toEqual({ workspacePath: '/work', source: '/main/task', destination: '/main' });
  });

  it('runs nothing unasked: it takes the server over a second on a big repository', () => {
    expect(conflictsCheckRequest(run({ asked: false }))).toBeUndefined();
  });

  it('runs nothing while the Changes tab is shown, nor on a request that is not open', () => {
    expect(conflictsCheckRequest(run({ tabShown: false }))).toBeUndefined();
    expect(conflictsCheckRequest(run({ state: 'Merged' }))).toBeUndefined();
    expect(conflictsCheckRequest(run({ state: 'Closed' }))).toBeUndefined();
    expect(conflictsCheckRequest(run({ state: 'Draft' }))).toBeUndefined();
  });

  it('runs nothing in a window with no workspace, nor for a branch not named', () => {
    expect(conflictsCheckRequest(run({ workspacePath: null }))).toBeUndefined();
    expect(conflictsCheckRequest(run({ source: undefined }))).toBeUndefined();
  });

  it('waits for both heads, which key it', () => {
    expect(conflictsCheckRequest(run({ sourceHead: undefined }))).toBeUndefined();
    expect(conflictsCheckRequest(run({ destinationHead: undefined }))).toBeUndefined();
  });

  // A head kept from earlier would key the check by where the destination was, not where it is.
  it("waits for the destination's head read again since Check", () => {
    expect(conflictsCheckRequest(run({ destinationRead: false }))).toBeUndefined();
  });
});

describe('conflictsCheckOf', () => {
  const counts = { status: 'ready', files: 2, directories: 0 } as const;
  const answer = (more: Partial<ConflictsCheckAnswer> = {}): ConflictsCheckAnswer => ({
    asked: true,
    destinationRead: true,
    checkFailed: false,
    destinationFailed: false,
    destinationMissing: false,
    ...more,
  });

  it('offers to check before it is asked on this page, even with an answer kept from an earlier visit', () => {
    expect(conflictsCheckOf(answer({ asked: false }))).toEqual({ kind: 'unchecked' });
    expect(conflictsCheckOf(answer({ asked: false, counts }))).toEqual({ kind: 'unchecked' });
  });

  it('offers to check again on a fresh visit after a check that failed', () => {
    expect(conflictsCheckOf(answer({ asked: false, checkFailed: true }))).toEqual({ kind: 'unchecked' });
    expect(conflictsCheckOf(answer({ asked: false, destinationFailed: true }))).toEqual({ kind: 'unchecked' });
    expect(conflictsCheckOf(answer({ asked: false, destinationMissing: true }))).toEqual({ kind: 'unchecked' });
  });

  it("is checking once asked, while the destination's head is read again and until the answer comes", () => {
    expect(conflictsCheckOf(answer({ destinationRead: false, counts }))).toEqual({ kind: 'checking' });
    expect(conflictsCheckOf(answer({ destinationRead: false, destinationFailed: true }))).toEqual({ kind: 'checking' });
    expect(conflictsCheckOf(answer())).toEqual({ kind: 'checking' });
  });

  it('shows the answer once asked, one kept for the same heads too', () => {
    expect(conflictsCheckOf(answer({ counts }))).toEqual({ kind: 'checked', counts });
  });

  it('fails when the preview failed, or the destination could not be read or no longer exists', () => {
    expect(conflictsCheckOf(answer({ checkFailed: true }))).toEqual({ kind: 'failed' });
    expect(conflictsCheckOf(answer({ destinationFailed: true }))).toEqual({ kind: 'failed' });
    expect(conflictsCheckOf(answer({ destinationMissing: true }))).toEqual({ kind: 'failed' });
  });
});
