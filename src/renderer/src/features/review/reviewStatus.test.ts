import { describe, expect, it } from 'vitest';
import { wholeList } from '../../lib/itemRange';
import { pairUnityMetas } from '../../lib/unityMetaPairs';
import { groupReviewStatus, hasMark, isAllReviewed, needsReview, pairedReviewStatusOf, partialReviewCount, reviewableOf, reviewProgress, shouldMarkReviewed, shownStatusOf, type ReviewStatus } from './reviewStatus';

const statuses: Record<string, ReviewStatus | null> = { a: 'reviewed', b: 'changedSinceReview', d: 'unreviewed', folder: null };
const statusOf = (item: string): ReviewStatus | null => statuses[item] ?? null;

describe('review status', () => {
  it('counts reviewed items, not folders, and not items changed since their review', () => {
    expect(reviewProgress(['a', 'b', 'd', 'folder'], statusOf)).toEqual({ total: 3, reviewed: 1 });
  });

  it('asks to review what was never reviewed or changed since', () => {
    expect(['a', 'b', 'd', 'folder'].map((item) => needsReview(statusOf, item))).toEqual([false, true, true, false]);
  });

  it('has a mark to clear once reviewed, even if changed since', () => {
    expect(['a', 'b', 'd', 'folder'].map((item) => hasMark(statusOf, item))).toEqual([true, true, false, false]);
  });

  it('marks a selection unless all of it is reviewed already', () => {
    expect(shouldMarkReviewed(['a', 'b'], statusOf)).toBe(true);
    expect(shouldMarkReviewed(['a'], statusOf)).toBe(false);
  });

  it('marks a folder reviewed once every file in it is', () => {
    expect(groupReviewStatus(wholeList(['a', 'folder']), statusOf)).toBe('reviewed');
    expect(groupReviewStatus(wholeList(['a', 'b']), statusOf)).toBe('unreviewed');
    expect(groupReviewStatus(wholeList(['folder']), statusOf)).toBeNull();
  });

  it('goes over only what the folder holds of the list it was laid out from', () => {
    expect(groupReviewStatus({ list: ['b', 'a', 'folder', 'b'], start: 1, end: 3 }, statusOf)).toBe('reviewed');
    expect(partialReviewCount({ list: ['b', 'a', 'b', 'd'], start: 0, end: 2 }, statusOf)).toBe('1/2');
  });

  it("counts a folder's reviewed files while its review is under way, not before or after", () => {
    expect(partialReviewCount(wholeList(['a', 'b', 'd', 'folder']), statusOf)).toBe('1/3');
    expect(partialReviewCount(wholeList(['b', 'd']), statusOf)).toBeNull();
    expect(partialReviewCount(wholeList(['a', 'folder']), statusOf)).toBeNull();
  });

  it('reviews files, not folders', () => {
    expect(reviewableOf(['a', 'folder', 'd'], statusOf)).toEqual(['a', 'd']);
  });

  it('shows the marks only in review mode, keeping them for when it is back', () => {
    const items = ['a', 'b', 'd', 'folder'];
    expect(items.map(shownStatusOf(statusOf, true))).toEqual(['reviewed', 'changedSinceReview', 'unreviewed', null]);
    expect(items.map(shownStatusOf(statusOf, false))).toEqual(['unreviewed', 'unreviewed', 'unreviewed', null]);
  });
});

describe('isAllReviewed', () => {
  it('tells whether every item to review is reviewed, going over none while review mode is off', () => {
    let asked = 0;
    const statusOf = (item: string) => (asked++, item === 'folder' ? null : item === 'a' ? 'reviewed' : 'unreviewed');

    expect(isAllReviewed(false, ['a', 'b'], statusOf)).toBe(false);
    expect(asked).toBe(0);
    expect(isAllReviewed(true, ['a', 'b'], statusOf)).toBe(false);
    expect(isAllReviewed(true, ['a', 'folder'], statusOf)).toBe(true);
    expect(isAllReviewed(true, ['folder'], statusOf)).toBe(false);
  });
});

describe('pairedReviewStatusOf', () => {
  const marks: Record<string, ReviewStatus | null> = {
    'a.png': 'reviewed', 'a.png.meta': 'reviewed',
    'b.png': 'reviewed', 'b.png.meta': 'changedSinceReview',
    'c.png': 'changedSinceReview', 'c.png.meta': 'unreviewed',
    'd.png': 'reviewed', 'd.png.meta': null,
    'e.png.meta': 'unreviewed',
  };
  const items = Object.keys(marks);
  const pairs = pairUnityMetas(items, (path) => path, () => 'changed');
  const statusOf = pairedReviewStatusOf((path: string) => marks[path] ?? null, pairs);

  it("gives an asset the status of the two that needs review most, and its joined meta none", () => {
    expect(items.map(statusOf)).toEqual(['reviewed', null, 'changedSinceReview', null, 'unreviewed', null, 'reviewed', null, 'unreviewed']);
  });

  it('counts a pair once', () => {
    expect(reviewProgress(items, statusOf)).toEqual({ total: 5, reviewed: 2 });
  });
});
