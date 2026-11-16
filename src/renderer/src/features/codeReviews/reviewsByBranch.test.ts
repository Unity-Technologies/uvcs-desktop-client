import { describe, expect, it } from 'vitest';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { reviewOfEachBranch } from './reviewsByBranch';

function review(id: number, targetBranchId?: number): CodeReviewSummary {
  return codeReviewSummary({ id, owner: 'jane', date: '2026-09-01', targetBranchId });
}

describe('reviewOfEachBranch', () => {
  it('keeps the newest review of each branch, by branch id, and skips changeset reviews', () => {
    const reviews = [review(3, 31266319), review(2), review(1, 31266319), review(0, 31296513)];
    const byBranch = reviewOfEachBranch(reviews);
    expect([...byBranch.keys()]).toEqual([31266319, 31296513]);
    expect(byBranch.get(31266319)?.id).toBe(3);
  });
});

describe('the review standing for a branch', () => {
  const request = (id: number, state: 'Draft' | 'Open' | 'Merged' | 'Closed') => codeReviewSummary({ id, targetBranchId: 7, mergeRequest: { state, destination: '/main' } });
  const standing = (...newestFirst: CodeReviewSummary[]) => reviewOfEachBranch(newestFirst).get(7)?.id;

  it('is a merge request still to merge, over any newer review', () => {
    expect(standing(review(9, 7), request(8, 'Merged'), request(5, 'Open'))).toBe(5);
    expect(standing(review(9, 7), request(6, 'Draft'))).toBe(6);
  });

  it('is the newest of two merge requests still to merge', () => {
    expect(standing(request(8, 'Draft'), request(5, 'Open'))).toBe(8);
  });

  it('is the newest review when none is still to merge', () => {
    expect(standing(request(9, 'Closed'), review(8, 7), request(5, 'Merged'))).toBe(9);
  });
});
