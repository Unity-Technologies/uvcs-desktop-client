import { useQuery } from '@tanstack/react-query';
import type { CodeReviewFilter } from '@shared/domain/codeReview';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';

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
