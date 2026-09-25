import { describe, expect, it } from 'vitest';
import { hasMark, needsReview, reviewProgress, shouldMarkReviewed, type ReviewStatus } from './reviewStatus';

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
});
