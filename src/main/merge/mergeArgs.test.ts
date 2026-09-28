import { describe, expect, it } from 'vitest';
import type { FileConflict, MergePlan, MergeResolutions } from '@shared/domain/merge';
import { fileConflictArgs, mergeSourceArgs } from './mergeArgs';

const conflict = (path: string): FileConflict => ({ path, itemId: 1, baseChangeset: 1, sourceChangeset: 2, destinationChangeset: 3, repository: 'game@local' });
const plan: MergePlan = { status: 'ready', changes: [], fileConflicts: [conflict('/a.txt'), conflict('/b.txt')], directoryConflicts: [], warnings: [] };

function resolutions(files: MergeResolutions['files']): MergeResolutions {
  return { directoryConflicts: [], files };
}

describe('mergeSourceArgs', () => {
  it('merges a shelve like any other source', () => {
    expect(mergeSourceArgs({ kind: 'merge', sourceSpec: 'sh:41' })).toEqual(['sh:41']);
  });

  it('reverts to an older changeset with an interval subtractive merge', () => {
    expect(mergeSourceArgs({ kind: 'subtractive', sourceSpec: 'cs:9', intervalOriginSpec: 'cs:4' })).toEqual(['cs:9', '--subtractive', '--interval-origin=cs:4']);
  });
});

describe('fileConflictArgs', () => {
  it('keeps the destination in workspace merges; the app writes the resolutions afterwards', () => {
    const text = resolutions({ '/a.txt': { choice: 'text', text: 'x' }, '/b.txt': { choice: 'source' } });
    expect(fileConflictArgs({ kind: 'merge', sourceSpec: 'sh:3' }, plan, text)).toEqual(['--keepdestination']);
  });

  it('keeps one side for every file in server merges', () => {
    const request = { kind: 'merge' as const, sourceSpec: 'br:/main/t', destinationBranch: '/main' };
    expect(fileConflictArgs(request, plan, resolutions({ '/a.txt': { choice: 'source' }, '/b.txt': { choice: 'source' } }))).toEqual(['--keepsource']);
    expect(fileConflictArgs(request, plan, resolutions({ '/a.txt': { choice: 'destination' }, '/b.txt': { choice: 'destination' } }))).toEqual([
      '--keepdestination',
    ]);
  });

  it('never leaves a server merge conflict to cm, which would open its merge tool', () => {
    const request = { kind: 'merge' as const, sourceSpec: 'br:/main/t', destinationBranch: '/main' };
    const merged = resolutions({ '/a.txt': { choice: 'text', text: 'x' }, '/b.txt': { choice: 'text', text: 'y' } });
    expect(() => fileConflictArgs(request, plan, merged)).toThrow();
    expect(() => fileConflictArgs(request, plan, resolutions({ '/a.txt': { choice: 'source' }, '/b.txt': { choice: 'destination' } }))).toThrow();
  });

  it('adds nothing without file conflicts', () => {
    expect(fileConflictArgs({ kind: 'merge', sourceSpec: 'sh:3' }, { ...plan, fileConflicts: [] }, resolutions({}))).toEqual([]);
  });
});
