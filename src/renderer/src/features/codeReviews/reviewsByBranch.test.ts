import { describe, expect, it } from 'vitest';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import type { CodeReviewSummary, MergeRequestState } from '@shared/domain/codeReview';
import type { MergeRequestReview } from './mergeRequestState';
import { currentRequestOf, reviewOfEachBranch, reviewStandingFor } from './reviewsByBranch';

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

describe('reviewStandingFor', () => {
  it("picks the review standing for one branch among that branch's reviews, by the same rule", () => {
    const request = codeReviewSummary({ id: 5, targetBranchId: 7, mergeRequest: { state: 'Open', destination: '/main' } });

    expect(reviewStandingFor([review(9, 7), request])?.id).toBe(5);
    expect(reviewStandingFor([])).toBeUndefined();
  });
});

describe("currentRequestOf, the merge request that stands for the workspace's branch (reviews listed newest first)", () => {
  const request = (id: number, state: MergeRequestState): MergeRequestReview => ({ ...review(id, 7), mergeRequest: { state, destination: '/main' } });
  const plainReview = (id: number) => review(id, 7);

  it('is the newest one still to merge, over a newer merged or closed one', () => {
    expect(currentRequestOf([request(9, 'Closed'), request(8, 'Merged'), request(5, 'Open')])?.id).toBe(5);
    expect(currentRequestOf([request(8, 'Draft'), request(5, 'Open')])?.id).toBe(8);
  });

  it('is a merged one when none is still to merge: the workspace is on finished work', () => {
    expect(currentRequestOf([request(9, 'Closed'), request(6, 'Merged'), request(4, 'Merged')])?.id).toBe(6);
  });

  it('is none for a branch whose only requests are closed', () => {
    expect(currentRequestOf([request(9, 'Closed'), request(3, 'Closed')])).toBeUndefined();
  });

  it('is none for a branch with only plain code reviews, or nothing', () => {
    expect(currentRequestOf([plainReview(9), plainReview(2)])).toBeUndefined();
    expect(currentRequestOf([])).toBeUndefined();
  });

  it('skips a newer plain code review of the branch', () => {
    expect(currentRequestOf([plainReview(9), request(5, 'Open')])?.id).toBe(5);
  });
});
