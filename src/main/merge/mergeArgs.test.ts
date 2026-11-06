import { describe, expect, it } from 'vitest';
import type { FileConflict, MergePlan } from '@shared/domain/merge';
import { fileConflictArgs, mergeSourceArgs } from './mergeArgs';

const conflict = (path: string): FileConflict => ({ path, destinationPath: path, itemId: 1, baseChangeset: 1, sourceChangeset: 2, destinationChangeset: 3, repository: 'game@local', destinationRevisionId: 30, destinationIsBinary: false });
const plan: MergePlan = { status: 'ready', changes: [], fileConflicts: [conflict('/a.txt'), conflict('/b.txt')], directoryConflicts: [], warnings: [] };

describe('mergeSourceArgs', () => {
  it('merges a shelve like any other source', () => {
    expect(mergeSourceArgs({ kind: 'merge', sourceSpec: 'sh:41' })).toEqual(['sh:41']);
  });

  it('reverts to an older changeset with an interval subtractive merge', () => {
    expect(mergeSourceArgs({ kind: 'subtractive', sourceSpec: 'cs:9', intervalOriginSpec: 'cs:4' })).toEqual(['cs:9', '--subtractive', '--interval-origin=cs:4']);
  });

  it('ignores merge tracking on a cherry pick or a subtractive merge', () => {
    expect(mergeSourceArgs({ kind: 'cherryPick', sourceSpec: 'cs:9', ignoreMergeTracking: true })).toEqual(['cs:9', '--cherrypicking', '--forced']);
    expect(mergeSourceArgs({ kind: 'subtractive', sourceSpec: 'cs:9', intervalOriginSpec: 'cs:4', ignoreMergeTracking: true })).toEqual(['cs:9', '--subtractive', '--interval-origin=cs:4', '--forced']);
  });

  it('never asks a regular merge to ignore merge tracking, which cm refuses', () => {
    expect(mergeSourceArgs({ kind: 'merge', sourceSpec: 'br:/main/task', ignoreMergeTracking: true })).toEqual(['br:/main/task']);
  });

  it('merges from the common ancestor the user chose, with the manual strategy so cm takes it for one', () => {
    // `--ancestor` without `--strategy=manual` turns the merge into an interval cherry pick.
    expect(mergeSourceArgs({ kind: 'merge', sourceSpec: 'br:/main/task', ancestorSpec: 'cs:5', destinationBranch: '/main' })).toEqual(['br:/main/task', '--strategy=manual', '--ancestor=cs:5', '--to=br:/main']);
  });

  it('chooses no ancestor where the merge already has one: a cherry pick, a range, a shelve', () => {
    expect(mergeSourceArgs({ kind: 'cherryPick', sourceSpec: 'cs:9', ancestorSpec: 'cs:5' })).toEqual(['cs:9', '--cherrypicking']);
    expect(mergeSourceArgs({ kind: 'subtractive', sourceSpec: 'cs:9', intervalOriginSpec: 'cs:4', ancestorSpec: 'cs:5' })).toEqual(['cs:9', '--subtractive', '--interval-origin=cs:4']);
    expect(mergeSourceArgs({ kind: 'merge', sourceSpec: 'sh:41', ancestorSpec: 'cs:5' })).toEqual(['sh:41']);
  });
});

describe('fileConflictArgs', () => {
  const toMain = { kind: 'merge' as const, sourceSpec: 'br:/main/t', destinationBranch: '/main' };

  it('keeps the destination in workspace merges; the app writes the resolutions afterwards', () => {
    expect(fileConflictArgs({ kind: 'merge', sourceSpec: 'sh:3' }, plan, '/tmp/r.json')).toEqual(['--keepdestination']);
  });

  it("hands cm each file's decision in server merges, so none is left to its merge tool", () => {
    expect(fileConflictArgs(toMain, plan, '/tmp/r.json')).toEqual(['--fileconflictsresolutionsfile=/tmp/r.json']);
  });

  it('adds nothing without file conflicts', () => {
    expect(fileConflictArgs({ kind: 'merge', sourceSpec: 'sh:3' }, { ...plan, fileConflicts: [] }, '/tmp/r.json')).toEqual([]);
    expect(fileConflictArgs(toMain, { ...plan, fileConflicts: [] }, '/tmp/r.json')).toEqual([]);
  });
});
