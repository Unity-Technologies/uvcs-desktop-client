import { describe, expect, it } from 'vitest';
import type { DirectoryConflict, MergePlan } from '@shared/domain/merge';
import { assertResolutionsComplete, describeUnmergeablePlan } from './mergeRules';

function directoryConflict(type: DirectoryConflict['type']): DirectoryConflict {
  const side = { operation: 'added' as const, path: '/twin.txt', description: 'Added /twin.txt' };
  return { type, title: 'Evil twin conflict', explanation: '', itemId: 1, isDirectory: false, source: side, destination: side };
}

const plan: MergePlan = {
  status: 'ready',
  changes: [],
  fileConflicts: [{ path: '/a.txt', itemId: 2, baseChangeset: 1, sourceChangeset: 2, destinationChangeset: 3, repository: 'game@local' }],
  directoryConflicts: [directoryConflict('evilTwin')],
  warnings: [],
};

describe('assertResolutionsComplete', () => {
  it('accepts a decision for every conflict', () => {
    expect(() =>
      assertResolutionsComplete(plan, {
        directoryConflicts: [{ choice: 'rename', newName: 'twin-dst.txt' }],
        files: { '/a.txt': { choice: 'text', text: 'merged' } },
      }),
    ).not.toThrow();
  });

  it('refuses when a file conflict has no decision', () => {
    expect(() => assertResolutionsComplete(plan, { directoryConflicts: [{ choice: 'source' }], files: {} })).toThrow(/a\.txt/);
  });

  it('refuses when directory conflicts are missing decisions', () => {
    expect(() => assertResolutionsComplete(plan, { directoryConflicts: [], files: { '/a.txt': { choice: 'source' } } })).toThrow();
  });

  it('refuses renames that are not file names', () => {
    expect(() =>
      assertResolutionsComplete(plan, { directoryConflicts: [{ choice: 'rename', newName: 'sub/x.txt' }], files: { '/a.txt': { choice: 'source' } } }),
    ).toThrow(/not a valid name/);
  });

  it('refuses renames for conflicts that cannot keep both items', () => {
    const deleteMove = { ...plan, directoryConflicts: [directoryConflict('deleteMove')] };
    expect(() =>
      assertResolutionsComplete(deleteMove, { directoryConflicts: [{ choice: 'rename', newName: 'x.txt' }], files: { '/a.txt': { choice: 'source' } } }),
    ).toThrow(/not possible/);
  });
});

describe('describeUnmergeablePlan', () => {
  it('explains why a merge cannot run', () => {
    expect(describeUnmergeablePlan({ ...plan, status: 'pendingChanges' })).toMatch(/pending changes/);
    expect(describeUnmergeablePlan(plan)).toBeNull();
  });
});
