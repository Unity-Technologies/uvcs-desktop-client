import { describe, expect, it } from 'vitest';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { standingReviewsOf } from './branchReviews';

const of = (id: number, branchId: number, review: Partial<CodeReviewSummary> = {}) => codeReviewSummary({ id, targetBranchId: branchId, ...review });

describe('standingReviewsOf', () => {
  it("answers every branch asked: the review that stands for it, or null when it has none", () => {
    const reviews = [of(9, 37), of(8, 41)];
    expect(standingReviewsOf([37, 41, 50], reviews)).toEqual(
      new Map([
        [37, reviews[0]],
        [41, reviews[1]],
        [50, null],
      ]),
    );
  });

  it("picks each branch's standing review as reviewStandingFor does: one still to merge over a newer plain review", () => {
    const plainNewer = of(12, 37);
    const openOlder = of(10, 37, { mergeRequest: { state: 'Open', destination: '/main' } });
    expect(standingReviewsOf([37], [plainNewer, openOlder]).get(37)).toBe(openOlder);
  });

  it('leaves out a review of a branch not asked for', () => {
    expect([...standingReviewsOf([37], [of(9, 99)]).keys()]).toEqual([37]);
  });
});
