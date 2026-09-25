import { useQuery } from '@tanstack/react-query';
import type { CodeReviewFilter } from '@shared/domain/codeReview';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { latestReviewByBranch } from './reviewsByBranch';

export function useCodeReviews(filter: CodeReviewFilter) {
  const workspacePath = useWorkspacePath();
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'codeReviews', filter),
    queryFn: () => api.codeReviews.list(workspacePath, filter),
    placeholderData: (previous) => previous,
  });
}

export function useCodeReview(reviewId: number) {
  const workspacePath = useWorkspacePath();
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'codeReviews', 'review', reviewId),
    queryFn: () => api.codeReviews.get(workspacePath, reviewId),
  });
}

/**
 * The newest review of each branch, for status chips next to branch names. Cached for a few minutes;
 * `enabled` lets a view ask only once its own data is in, so the chips never delay it.
 */
export function useReviewsByBranch(enabled = true) {
  const workspacePath = useWorkspacePath();
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'codeReviews', 'byBranch'),
    queryFn: () => api.codeReviews.list(workspacePath, { scope: 'all' }),
    select: latestReviewByBranch,
    staleTime: 5 * 60_000,
    enabled,
  });
}
