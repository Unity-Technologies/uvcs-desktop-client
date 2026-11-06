import { useQuery } from '@tanstack/react-query';
import type { CodeReviewer, CodeReviewSummary } from '@shared/domain/codeReview';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { usePlace } from '../../app/workspace/useWorkspace';

/**
 * One review's reviewers, each typed a user or a group by `cm` (`cm codereview reviewer list`): what decides how the
 * review's page and its reviewer pickers name them (`--users` or `--groups`), where the server's groups can't tell
 * (a server that lists none). One command for the review shown, never per row of a list. Under the reviews' area, so
 * whatever changes a review reads it again (`isAffectedByCodeReviews`). Until it answers, or should it fail, the
 * reviewers as the review was read, untyped.
 */
export function useReviewersOf(review: Pick<CodeReviewSummary, 'id' | 'reviewers'>): { reviewers: readonly CodeReviewer[]; settled: boolean } {
  const place = usePlace();
  const { data, isPending } = useQuery({
    queryKey: queryKeys.inPlace(place, 'codeReviews', 'reviewers', review.id),
    queryFn: () => api.codeReviews.reviewers(place, review.id),
  });
  return { reviewers: data ?? review.reviewers, settled: !isPending };
}
