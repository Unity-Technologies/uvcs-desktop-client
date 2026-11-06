import type { CodeReviewSummary } from '@shared/domain/codeReview';

/** A review as the lists read it, with nothing said yet, for tests: what a test cares about goes in `review`. */
export function codeReviewSummary(review: Partial<CodeReviewSummary> & Pick<CodeReviewSummary, 'id'>): CodeReviewSummary {
  return {
    title: `Review ${review.id}`,
    status: 'Under review',
    owner: 'bob',
    reviewers: [],
    date: '',
    lastActivity: '',
    commentCount: 0,
    openIssueCount: 0,
    ...review,
  };
}
