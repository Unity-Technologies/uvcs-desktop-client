import { useQuery } from '@tanstack/react-query';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { usePlace } from '../../app/workspace/useWorkspace';
import { readsReviewerTypes, reviewersRead, type ReviewersRead } from './reviewersRead';

/**
 * One review's reviewers, each typed a user or a group by `cm` (`cm codereview reviewer list`): what decides how the
 * review's page and its reviewer pickers name them (`--users` or `--groups`), where the server's groups can't tell
 * (a server that lists none, a directory that refuses the whole list). One command for the review shown, never per
 * row of a list, and none for a review with no reviewers. Under the reviews' area, so whatever changes a review reads
 * it again (`isAffectedByCodeReviews`). Until it answers, or should it fail, the reviewers as the review was read.
 */
export function useReviewersOf(review: Pick<CodeReviewSummary, 'id' | 'reviewers'>): ReviewersRead {
  const place = usePlace();
  const { data, isPending } = useQuery({
    queryKey: queryKeys.inPlace(place, 'codeReviews', 'reviewers', review.id),
    queryFn: () => api.codeReviews.reviewers(place, review.id),
    enabled: readsReviewerTypes(review),
  });
  return reviewersRead(review.reviewers, { data, pending: isPending });
}
