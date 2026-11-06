import type { CodeReviewer, CodeReviewSummary } from '@shared/domain/codeReview';

/** A review's reviewers to show, and whether they're as final as they'll get (what a dialog's pick waits for). */
export interface ReviewersRead {
  reviewers: readonly CodeReviewer[];
  settled: boolean;
}

/** Whether `cm codereview reviewer list` is worth a command: only for a review someone was asked to review. */
export function readsReviewerTypes(review: Pick<CodeReviewSummary, 'reviewers'>): boolean {
  return review.reviewers.length > 0;
}

/**
 * The reviewers as `cm` typed them once it answered; until then, or when it failed, as the review read them, untyped.
 * A review with no reviewers is settled at once: nothing is asked of it (`readsReviewerTypes`).
 */
export function reviewersRead(listed: readonly CodeReviewer[], read: { data?: readonly CodeReviewer[]; pending: boolean }): ReviewersRead {
  return { reviewers: read.data ?? listed, settled: listed.length === 0 || !read.pending };
}
