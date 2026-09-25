import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { diffReviewName, diffReviewStatusOf, reviewedRevisionToCompare } from './diffReview';

const entry = (path: string, revisionId: number, itemType: DiffEntry['itemType'] = 'file'): DiffEntry => ({
  status: 'changed',
  path,
  itemType,
  baseRevisionId: 1,
  revisionId,
});

const marks = new Map([
  ['a.ts', 10],
  ['b.ts', 11],
  ['gone.ts', 12],
]);

describe('diff review', () => {
  it('names each kind of diff, a branch without its head', () => {
    expect(diffReviewName({ kind: 'changeset', changesetId: 42 })).toBe('cs:42');
    expect(diffReviewName({ kind: 'branch', branch: '/main/task' })).toBe('br:/main/task');
    expect(diffReviewName({ kind: 'shelve', shelveId: 3 })).toBe('sh:3');
    expect(diffReviewName({ kind: 'range', fromSpec: 'cs:1', toSpec: 'cs:5' })).toBe('cs:1..cs:5');
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
