import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { branchGuidFor } from '@shared/testing/stableIdsFor';
import { diffReviewName, diffReviewStatusOf, formerDiffReviewName, reviewedRevisionToCompare } from './diffReview';

const entry = (path: string, revisionId: number, itemType: DiffEntry['itemType'] = 'file'): DiffEntry => ({
  status: 'changed',
  path,
  itemType,
  baseRevisionId: 1,
  revisionId,
  repository: 'game@local',
});

const marks = new Map([
  ['a.ts', 10],
  ['b.ts', 11],
  ['gone.ts', 12],
]);

describe('diff review', () => {
  it('names each kind of diff, a branch by its GUID without its head', () => {
    const task = branchGuidFor(1);
    expect(diffReviewName({ kind: 'changeset', changesetId: 42 }, undefined)).toBe('cs:42');
    expect(diffReviewName({ kind: 'branch', branch: '/main/task' }, task)).toBe(`br:${task}`);
    expect(diffReviewName({ kind: 'shelve', shelveId: 3 }, undefined)).toBe('sh:3');
    expect(diffReviewName({ kind: 'range', fromSpec: 'cs:1', toSpec: 'cs:5' }, undefined)).toBe('cs:1..cs:5');
  });

  it('names no branch diff while its GUID isn’t known, and the one its marks were kept by before', () => {
    expect(diffReviewName({ kind: 'branch', branch: '/main/task' }, undefined)).toBeUndefined();
    expect(formerDiffReviewName({ kind: 'branch', branch: '/main/task' })).toBe('br:/main/task');
    expect(formerDiffReviewName({ kind: 'changeset', changesetId: 42 })).toBeUndefined();
  });

  it('tells a file changed since its review by its revision', () => {
    const statusOf = diffReviewStatusOf(marks);
    expect([entry('a.ts', 10), entry('b.ts', 20), entry('c.ts', 30)].map(statusOf)).toEqual(['reviewed', 'changedSinceReview', 'unreviewed']);
    expect(statusOf(entry('src', 5, 'directory'))).toBeNull();
  });

  it('compares with the revision reviewed only when both sides exist', () => {
    expect(reviewedRevisionToCompare(marks, entry('b.ts', 20))).toBe(11);
    expect(reviewedRevisionToCompare(marks, entry('a.ts', 10))).toBeNull();
    expect(reviewedRevisionToCompare(marks, entry('gone.ts', -1))).toBeNull();
    expect(reviewedRevisionToCompare(marks, entry('c.ts', 30))).toBeNull();
  });
});
