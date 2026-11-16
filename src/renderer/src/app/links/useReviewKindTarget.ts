import { useQuery } from '@tanstack/react-query';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { Place } from '@shared/domain/place';
import { codeReviewKey } from '../../features/codeReviews/codeReviewKey';
import type { LinkTarget } from './linkNavigation';
import { withReviewKind } from './reviewLinkKind';

/**
 * A link target with its review named as the link copies it (`placeLinkTo`): a merge request's once its page read it.
 * It only watches what the cache holds (the page's own read, `codeReviewKey`) and reads nothing: for what a "Copy
 * link" button says it copies ("Copy link to merge request 12").
 */
export function useReviewKindTarget(place: Place | null, target: LinkTarget | null): LinkTarget | null {
  const reviewId = target?.object?.kind === 'codeReview' ? target.object.id : undefined;
  const { data: review } = useQuery<CodeReviewSummary>({
    queryKey: place && reviewId !== undefined ? codeReviewKey(place, reviewId) : ['no review'],
    enabled: false,
  });
  if (!target) return null;
  return withReviewKind(target, () => review?.mergeRequest !== undefined);
}
