import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { usePlace } from '../../../app/workspace/useWorkspace';

/**
 * Everything said on a review, read with one `cm find`. Under the reviews' area, so whatever changes a review reads it
 * again (`isAffectedByCodeReviews`), and so does a focus once stale: others write on it too.
 */
export function useReviewConversation(reviewId: number) {
  const place = usePlace();
  return useQuery({
    queryKey: queryKeys.inPlace(place, 'codeReviews', 'conversation', reviewId),
    queryFn: () => api.reviewComments.conversation(place, reviewId),
  });
}
