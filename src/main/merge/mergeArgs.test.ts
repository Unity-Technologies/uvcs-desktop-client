import { describe, expect, it } from 'vitest';
import type { FileConflict, MergePlan } from '@shared/domain/merge';
import { fileConflictArgs, mergeSourceArgs } from './mergeArgs';

const conflict = (path: string): FileConflict => ({ path, itemId: 1, baseChangeset: 1, sourceChangeset: 2, destinationChangeset: 3, repository: 'game@local' });
const plan: MergePlan = { status: 'ready', changes: [], fileConflicts: [conflict('/a.txt'), conflict('/b.txt')], directoryConflicts: [], warnings: [] };

describe('mergeSourceArgs', () => {
  it('merges a shelve like any other source', () => {
    expect(mergeSourceArgs({ kind: 'merge', sourceSpec: 'sh:41' })).toEqual(['sh:41']);
  });

  it('reverts to an older changeset with an interval subtractive merge', () => {
    expect(mergeSourceArgs({ kind: 'subtractive', sourceSpec: 'cs:9', intervalOriginSpec: 'cs:4' })).toEqual(['cs:9', '--subtractive', '--interval-origin=cs:4']);
  });
});

describe('fileConflictArgs', () => {
  const toMain = { kind: 'merge' as const, sourceSpec: 'br:/main/t', destinationBranch: '/main' };

  it('keeps the destination in workspace merges; the app writes the resolutions afterwards', () => {
    expect(fileConflictArgs({ kind: 'merge', sourceSpec: 'sh:3' }, plan, '/tmp/r.json')).toEqual(['--keepdestination']);
  });

  it("hands cm each file's decision in server merges, so none is left to its merge tool", () => {
    expect(fileConflictArgs(toMain, plan, '/tmp/r.json')).toEqual(['--fileresolutionsfile=/tmp/r.json']);
  });

  it('adds nothing without file conflicts', () => {
    expect(fileConflictArgs({ kind: 'merge', sourceSpec: 'sh:3' }, { ...plan, fileConflicts: [] }, '/tmp/r.json')).toEqual([]);
    expect(fileConflictArgs(toMain, { ...plan, fileConflicts: [] }, '/tmp/r.json')).toEqual([]);
  });
});
