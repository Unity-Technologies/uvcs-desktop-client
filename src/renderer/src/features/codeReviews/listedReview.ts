import type { QueryClient } from '@tanstack/react-query';
import type { Place } from '@shared/domain/place';
import type { CodeReview, CodeReviewSummary } from '@shared/domain/codeReview';
import { queryKeys } from '../../api/queryKeys';

/**
 * A review as a list already read it (the Code reviews view's), with when that list was read: its page shows it at
 * once, as fresh as that list. A summary (the branch chips', the palette's) counts only with its target named: a
 * changeset's or shelve's is, a branch's isn't (`CodeReviewSummary.target`).
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

/**
 * The review from the workspace's code review queries in `client` (lists; the single reviews and summaries without
 * their target are skipped), but those an operation marked stale and nobody read again: their copy may hold an old status.
 */
export function listedReviewIn(client: QueryClient, place: Place, reviewId: number): { review: CodeReview; readAt: number } | undefined {
  const lists = client
    .getQueryCache()
    .findAll({ queryKey: queryKeys.inPlace(place, 'codeReviews') })
    .filter((query) => !query.state.isInvalidated)
    .map((query) => ({ data: query.state.data, readAt: query.state.dataUpdatedAt }));
  return listedReview(lists, reviewId);
}
