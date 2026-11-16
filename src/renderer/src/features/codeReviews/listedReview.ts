import type { QueryClient } from '@tanstack/react-query';
import type { Place } from '@shared/domain/place';
import type { CodeReview, CodeReviewSummary, MergeRequestInfo } from '@shared/domain/codeReview';
import { queryKeys } from '../../api/queryKeys';

/**
 * A review as a list already read it (the Merge requests view's), with when that list was read: its page shows it at
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
 * The review from the workspace's code review queries in `client` (lists; the single reviews, a review's typed reviewers
 * (`useReviewersOf`, objects with no id) and summaries without their target are skipped), but those an operation marked stale and nobody read again: their copy may hold an old status.
 */
export function listedReviewIn(client: QueryClient, place: Place, reviewId: number): { review: CodeReview; readAt: number } | undefined {
  const lists = client
    .getQueryCache()
    .findAll({ queryKey: queryKeys.inPlace(place, 'codeReviews') })
    .filter((query) => !query.state.isInvalidated)
    .map((query) => ({ data: query.state.data, readAt: query.state.dataUpdatedAt }));
  return listedReview(lists, reviewId);
}

/**
 * A list of reviews with the review just read in place of its row: the status, title and counts its page shows, while
 * the list's other rows stay as they were read. Anything else (not a list, a list without it) comes back as it was.
 */
export function withReviewRead(data: unknown, review: CodeReview): unknown {
  if (!Array.isArray(data)) return data;
  const rows = data as (CodeReview | CodeReviewSummary)[];
  const at = rows.findIndex((row) => row.id === review.id);
  if (at === -1) return data;
  return rows.map((row, index) => (index === at ? { ...row, ...review } : row));
}

/**
 * Puts the review just read into the lists already read that hold it (`withReviewRead`), so the Merge requests view under
 * its page shows what the page does when the user goes back, with no `cm` command of its own. Each list keeps when it
 * was read, so it's read again when it would have been; one an operation marked stale is left to that read.
 */
export function showReviewReadInListsIn(client: QueryClient, place: Place, review: CodeReview): void {
  for (const query of client.getQueryCache().findAll({ queryKey: queryKeys.inPlace(place, 'codeReviews') })) {
    if (query.state.isInvalidated) continue;
    const updated = withReviewRead(query.state.data, review);
    if (updated !== query.state.data) client.setQueryData(query.queryKey, updated, { updatedAt: query.state.dataUpdatedAt });
  }
}

/**
 * A list of reviews with one merge request's state or destination changed as a write just left it, the other rows
 * as they were read: what a move shows at once, its page opened or not (`setMergeRequestState`). Anything else (not a
 * list, a list without it, a row that isn't a merge request) comes back as it was.
 */
export function withMergeRequestChanged(data: unknown, reviewId: number, change: Partial<MergeRequestInfo>): unknown {
  if (!Array.isArray(data)) return data;
  const rows = data as (CodeReview | CodeReviewSummary)[];
  const at = rows.findIndex((row) => row.id === reviewId && row.mergeRequest !== undefined);
  if (at === -1) return data;
  return rows.map((row, index) => (index === at && row.mergeRequest ? { ...row, mergeRequest: { ...row.mergeRequest, ...change } } : row));
}

/** `withMergeRequestChanged` over every list already read and not marked stale, each keeping when it was read. */
export function showMergeRequestChangedInListsIn(client: QueryClient, place: Place, reviewId: number, change: Partial<MergeRequestInfo>): void {
  for (const query of client.getQueryCache().findAll({ queryKey: queryKeys.inPlace(place, 'codeReviews') })) {
    if (query.state.isInvalidated) continue;
    const updated = withMergeRequestChanged(query.state.data, reviewId, change);
    if (updated !== query.state.data) client.setQueryData(query.queryKey, updated, { updatedAt: query.state.dataUpdatedAt });
  }
}
