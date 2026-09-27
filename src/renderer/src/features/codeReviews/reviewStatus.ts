import type { CodeReviewSummary } from '@shared/domain/codeReview';

/** `cm codereview -e --status` succeeds without changing anything on a review nobody is assigned to. */
export function needsReviewerForStatus(review: Pick<CodeReviewSummary, 'assignee'>): boolean {
  return review.assignee.trim() === '';
}
