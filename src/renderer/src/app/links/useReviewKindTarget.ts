import { useCallback, useSyncExternalStore } from 'react';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { Place } from '@shared/domain/place';
import { codeReviewKey } from '../../features/codeReviews/codeReviewKey';
import { queryClient } from '../queryClient';
import type { LinkTarget } from './linkNavigation';
import { withReviewKind } from './reviewLinkKind';

/**
 * A link target with its review named as the link copies it (`placeLinkTo`): a merge request's once its page read it.
 * It only watches what the cache holds (the page's own read, `codeReviewKey`), creating no query and reading nothing:
 * for what a "Copy link" button says it copies ("Copy link to merge request 12").
 */
export function useReviewKindTarget(place: Place | null, target: LinkTarget | null): LinkTarget | null {
  const reviewId = target?.object?.kind === 'codeReview' ? target.object.id : undefined;
  const isMergeRequest = useCallback(
    () => place !== null && reviewId !== undefined && queryClient.getQueryData<CodeReviewSummary>(codeReviewKey(place, reviewId))?.mergeRequest !== undefined,
    [place, reviewId],
  );
  const subscribe = useCallback((changed: () => void) => queryClient.getQueryCache().subscribe(changed), []);
  const mergeRequest = useSyncExternalStore(subscribe, isMergeRequest);
  if (!target) return null;
  return withReviewKind(target, () => mergeRequest);
}
