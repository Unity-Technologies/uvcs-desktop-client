import { useQuery } from '@tanstack/react-query';
import type { Place } from '@shared/domain/place';
import type { CodeReviewFilter } from '@shared/domain/codeReview';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { queryClient, SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { usePlace } from '../../app/workspace/useWorkspace';
import { compactFilter } from '../../lib/compactFilter';
import { listedReviewIn } from './listedReview';
import { latestReviewByBranch } from './reviewsByBranch';

export function useCodeReviews(filter: CodeReviewFilter) {
  const place = usePlace();
  // Equivalent filters (no owners, not only assigned) share one cache entry and one `cm find`.
  const query = compactFilter(filter);
  return useQuery({
    queryKey: queryKeys.inPlace(place, 'codeReviews', query),
    queryFn: () => api.codeReviews.list(place, query),
    placeholderData: (previous) => previous,
  });
}

export function useCodeReview(reviewId: number) {
  const place = usePlace();
  // Opened from a list that read it, the page shows at once, as fresh as that list: read again only once it's stale.
  const listed = () => listedReviewIn(queryClient, place, reviewId);
  return useQuery({
    queryKey: queryKeys.inPlace(place, 'codeReviews', 'review', reviewId),
    queryFn: () => api.codeReviews.get(place, reviewId),
    initialData: () => listed()?.review,
    initialDataUpdatedAt: () => listed()?.readAt,
  });
}

/** The newest reviews of the repository as `cm` lists them, branch targets by id; `text` narrows them by title. */
export function reviewSummariesKey(place: Place, text?: string): readonly unknown[] {
  return queryKeys.inPlace(place, 'codeReviews', 'summaries', { text });
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
 * How the newest reviews of the repository are read, all of them (`reviewSummariesKey` without a text): rarely, as
 * the palette reads the same list, and a focus never reads them again.
 */
export function reviewSummariesQuery(place: Place) {
  return {
    queryKey: reviewSummariesKey(place),
    queryFn: () => api.codeReviews.listSummaries(place, {}),
    ...SLOW_CHANGING_QUERY,
  };
}
