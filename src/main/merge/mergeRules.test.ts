import { describe, expect, it } from 'vitest';
import type { DirectoryConflict, MergePlan } from '@shared/domain/merge';
import { assertDecisionValid, assertResolutionsComplete, describeUnmergeablePlan } from './mergeRules';

function directoryConflict(type: DirectoryConflict['type']): DirectoryConflict {
  const side = { operation: 'added' as const, path: '/twin.txt', description: 'Added /twin.txt' };
  return { type, title: 'Evil twin conflict', explanation: '', itemId: 1, isDirectory: false, source: side, destination: side };
}

const plan: MergePlan = {
  status: 'ready',
  changes: [],
  fileConflicts: [{ path: '/a.txt', destinationPath: '/a.txt', itemId: 2, baseChangeset: 1, sourceChangeset: 2, destinationChangeset: 3, repository: 'game@local', destinationRevisionId: 30, destinationIsBinary: false }],
  directoryConflicts: [directoryConflict('evilTwin')],
  warnings: [],
};

describe('assertResolutionsComplete', () => {
  const decided: MergePlan = { ...plan, directoryConflicts: [] };

  it('accepts a decision for every file conflict once no directory conflict is left', () => {
    expect(() => assertResolutionsComplete(decided, { files: { '/a.txt': { choice: 'text', text: 'merged' } } })).not.toThrow();
  });

  it('refuses when a file conflict has no decision', () => {
    expect(() => assertResolutionsComplete(decided, { files: {} })).toThrow(/a\.txt/);
  });

  it('refuses to keep the base of a file added on both sides, which has none', () => {
    const addedOnBoth = { ...decided, fileConflicts: [{ ...plan.fileConflicts[0]!, baseChangeset: -1 }] };
    expect(() => assertResolutionsComplete(addedOnBoth, { files: { '/a.txt': { choice: 'base' } } })).toThrow(/a\.txt has no base/);
    expect(() => assertResolutionsComplete(decided, { files: { '/a.txt': { choice: 'base' } } })).not.toThrow();
  });

  it('refuses while a directory conflict is left: its decision is applied as it is made, so it has none', () => {
    expect(() => assertResolutionsComplete(plan, { files: { '/a.txt': { choice: 'source' } } })).toThrow(/directory conflict/);
  });
});

describe('assertDecisionValid', () => {
  it('takes keeping one side of any conflict, and both items under a name', () => {
    expect(() => assertDecisionValid({ conflict: directoryConflict('deleteMove'), resolution: { choice: 'source' } })).not.toThrow();
    expect(() => assertDecisionValid({ conflict: directoryConflict('evilTwin'), resolution: { choice: 'rename', newName: 'twin-dst.txt' } })).not.toThrow();
  });

  it('refuses renames that are not file names', () => {
    expect(() => assertDecisionValid({ conflict: directoryConflict('evilTwin'), resolution: { choice: 'rename', newName: 'sub/x.txt' } })).toThrow(/not a valid name/);
  });

  it('refuses renames for conflicts that cannot keep both items', () => {
    expect(() => assertDecisionValid({ conflict: directoryConflict('deleteMove'), resolution: { choice: 'rename', newName: 'x.txt' } })).toThrow(/not possible/);
  });
});

describe('describeUnmergeablePlan', () => {
  it('explains why a merge cannot run', () => {
    expect(describeUnmergeablePlan({ ...plan, status: 'pendingChanges' })).toMatch(/pending changes/);
    expect(describeUnmergeablePlan(plan)).toBeNull();
  });
});
