import { useQuery } from '@tanstack/react-query';
import type { CodeReviewFilter } from '@shared/domain/codeReview';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { queryClient, SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { compactFilter } from '../../lib/compactFilter';
import { listedReview } from './listedReview';
import { latestReviewByBranch } from './reviewsByBranch';

export function useCodeReviews(filter: CodeReviewFilter) {
  const workspacePath = useWorkspacePath();
  // Equivalent filters (no owners, not only assigned) share one cache entry and one `cm find`.
  const query = compactFilter(filter);
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'codeReviews', query),
    queryFn: () => api.codeReviews.list(workspacePath, query),
    placeholderData: (previous) => previous,
  });
}

export function useCodeReview(reviewId: number) {
  const workspacePath = useWorkspacePath();
  // Opened from a list that read it, the page shows at once, then reads it again as it would anyway.
  const listed = () => listedReview(listsRead(workspacePath), reviewId);
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'codeReviews', 'review', reviewId),
    queryFn: () => api.codeReviews.get(workspacePath, reviewId),
    initialData: () => listed()?.review,
    initialDataUpdatedAt: () => listed()?.readAt,
  });
}

/** Every code review query read in the workspace: lists, and the single reviews and summaries, which `listedReview` skips. */
function listsRead(workspacePath: string): { data: unknown; readAt: number }[] {
  return queryClient
    .getQueryCache()
    .findAll({ queryKey: queryKeys.inWorkspace(workspacePath, 'codeReviews') })
    .map((query) => ({ data: query.state.data, readAt: query.state.dataUpdatedAt }));
}

/** The newest reviews of the repository as `cm` lists them, branch targets by id; `text` narrows them by title. */
export function reviewSummariesKey(workspacePath: string, text?: string): readonly unknown[] {
  return queryKeys.inWorkspace(workspacePath, 'codeReviews', 'summaries', { text });
}

/**
 * The newest review of each branch by branch id, for status chips next to branch names (the lists showing them know
 * their branches' ids, so no name is looked up). The command palette lists the same reviews, read rarely;
 * `enabled` lets a view ask only once its own data is in, so the chips never delay it.
 */
export function useReviewsByBranch(enabled = true) {
  const workspacePath = useWorkspacePath();
  return useQuery({ ...reviewSummariesQuery(workspacePath), select: latestReviewByBranch, enabled });
}

/**
 * How the newest reviews of the repository are read, all of them (`reviewSummariesKey` without a text): rarely, as
 * the palette reads the same list, and a focus never reads them again.
 */
export function reviewSummariesQuery(workspacePath: string) {
  return {
    queryKey: reviewSummariesKey(workspacePath),
    queryFn: () => api.codeReviews.listSummaries(workspacePath, {}),
    ...SLOW_CHANGING_QUERY,
  };
}
