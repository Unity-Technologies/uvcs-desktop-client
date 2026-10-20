import type { CodeReview, CodeReviewSummary } from '@shared/domain/codeReview';

/**
 * A review as a list already read it (the Code reviews view's), with when that list was read: its page shows it at
 * once, as fresh as that list. Summaries (the branch chips') lack the target, so they don't count.
 */
export function listedReview(lists: readonly { data: unknown; readAt: number }[], reviewId: number): { review: CodeReview; readAt: number } | undefined {
  let found: { review: CodeReview; readAt: number } | undefined;
  for (const { data, readAt } of lists) {
    if (!Array.isArray(data)) continue;
    const review = (data as (CodeReview | CodeReviewSummary)[]).find((each) => each.id === reviewId && 'target' in each);
    if (review && (!found || readAt > found.readAt)) found = { review: review as CodeReview, readAt };
  }
  return found;
}
