import { describe, expect, it } from 'vitest';
import type { CodeReviewer } from '@shared/domain/codeReview';
import { reviewersRead, readsReviewerTypes } from './reviewersRead';

const LISTED: CodeReviewer[] = [{ name: 'staff', status: 'Under review' }];
const TYPED: CodeReviewer[] = [{ name: 'staff', status: 'Under review', kind: 'group' }];

describe('reading a review’s reviewers typed by cm', () => {
  it('asks cm only about a review someone was asked to review: nobody else can be typed', () => {
    expect(readsReviewerTypes({ reviewers: LISTED })).toBe(true);
    expect(readsReviewerTypes({ reviewers: [] })).toBe(false);
  });

  it('shows the reviewers as the review read them while cm answers, then as cm typed them', () => {
    expect(reviewersRead(LISTED, { pending: true })).toEqual({ reviewers: LISTED, settled: false });
    expect(reviewersRead(LISTED, { data: TYPED, pending: false })).toEqual({ reviewers: TYPED, settled: true });
  });

  it('settles on the untyped reviewers when cm failed, and at once for a review with none', () => {
    expect(reviewersRead(LISTED, { pending: false })).toEqual({ reviewers: LISTED, settled: true });
    // A query that never runs stays pending (TanStack Query's `isPending` with no data).
    expect(reviewersRead([], { pending: true })).toEqual({ reviewers: [], settled: true });
  });
});
