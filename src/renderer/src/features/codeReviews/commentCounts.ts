import type { CodeReviewSummary } from '@shared/domain/codeReview';

type Counted = Pick<CodeReviewSummary, 'commentCount' | 'openIssueCount'>;

/** What a review's comment counts say aloud and in their tooltip: "12 comments, 2 open". */
export function commentCountsText({ commentCount, openIssueCount }: Counted): string {
  const comments = commentCount === 1 ? '1 comment' : `${commentCount} comments`;
  return openIssueCount > 0 ? `${comments}, ${openIssueCount} open` : comments;
}

/**
 * Sorts by what's still open first, then by how much was said: reviews with open change requests or questions are
 * the ones to look at. A review can't hold a million comments, so the open count always weighs more.
 */
export function commentCountsSortValue({ commentCount, openIssueCount }: Counted): number {
  return openIssueCount * 1_000_000 + commentCount;
}
