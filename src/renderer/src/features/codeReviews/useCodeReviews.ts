import { useQuery } from '@tanstack/react-query';
import type { Place } from '@shared/domain/place';
import { NEWEST_CODE_REVIEWS, type CodeReviewFilter } from '@shared/domain/codeReview';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { queryClient, SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { usePlace } from '../../app/workspace/useWorkspace';
import { compactFilter } from '../../lib/compactFilter';
import { codeReviewKey } from './codeReviewKey';
import { listedReviewIn, showReviewReadInListsIn } from './listedReview';
import { latestReviewByBranch } from './reviewsByBranch';

/** `enabled` false reads nothing, only what the list already read (the sidebar's count, `useWaitingForMeBadge`). */
export function useCodeReviews(filter: CodeReviewFilter, { enabled = true }: { enabled?: boolean } = {}) {
  const place = usePlace();
  // Equivalent filters (no owners, not only assigned) share one cache entry and one `cm find`.
  const query = compactFilter(filter);
  return useQuery({
    queryKey: queryKeys.inPlace(place, 'codeReviews', query),
    queryFn: () => api.codeReviews.list(place, query),
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useCodeReview(reviewId: number) {
  return useQuery(codeReviewQuery(usePlace(), reviewId));
}

/**
 * The review's read, its page's, and what reads it before the page shows it (a link to a comment), which the page then
 * finds read. Opened from a list that read it, the page shows at once, as fresh as that list: read again only once
 * it's stale.
 */
export function codeReviewQuery(place: Place, reviewId: number) {
  const listed = () => listedReviewIn(queryClient, place, reviewId);
  return {
    queryKey: codeReviewKey(place, reviewId),
    initialData: () => listed()?.review,
    initialDataUpdatedAt: () => listed()?.readAt,
    queryFn: async () => {
      const review = await api.codeReviews.get(place, reviewId);
      // The lists under the page show the review as it now is too (a Refresh, a focus): going back finds them in step.
      showReviewReadInListsIn(queryClient, place, review);
      return review;
    },
  };
}

/** The newest reviews of the repository as `cm` lists them, branch targets by id; `text` narrows them by title. */
export function reviewSummariesKey(place: Place, text?: string): readonly unknown[] {
  return queryKeys.inPlace(place, 'codeReviews', 'summaries', { text });
}

/** The reviews of one branch, for the change requests a check-in can apply (`branchReviewsQuery`). */
export function branchReviewsKey(place: Place, branch: string): readonly unknown[] {
  return queryKeys.inPlace(place, 'codeReviews', 'summaries', { targetBranch: branch });
}

/** The review with one number, as the palette looks up a number typed (`reviewNumberToLookUp`). */
export function reviewNumberedKey(place: Place, id: number): readonly unknown[] {
  return queryKeys.inPlace(place, 'codeReviews', 'summaries', { id });
}

/**
 * The newest review of each branch by branch id, for status chips next to branch names (the lists showing them know
 * their branches' ids, so no name is looked up). The command palette lists the same reviews, read rarely;
 * `enabled` lets a view ask only once its own data is in, so the chips never delay it.
 */
export function useReviewsByBranch(enabled = true) {
  const place = usePlace();
  return useQuery({ ...reviewSummariesQuery(place), select: latestReviewByBranch, enabled });
}

/**
 * How the newest reviews of the repository are read (`NEWEST_CODE_REVIEWS`, `reviewSummariesKey` without a text):
 * rarely, as the palette reads the same list, and a focus never reads them again.
 */
export function reviewSummariesQuery(place: Place) {
  return {
    queryKey: reviewSummariesKey(place),
    queryFn: () => api.codeReviews.listSummaries(place, { limit: NEWEST_CODE_REVIEWS }),
    ...SLOW_CHANGING_QUERY,
  };
}
