import { useQuery } from '@tanstack/react-query';
import type { Place } from '@shared/domain/place';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { cmVersionQuery } from '../../app/startup/useCmAvailability';
import { usePlace } from '../../app/workspace/useWorkspace';
import { readsReviewSubscriptions, subscriptionSection, type SubscriptionSection } from './reviewSubscription';

/** Where a review's email subscription is kept: under the reviews' area, so every write on a review reads it again. */
export function reviewSubscriptionKey(place: Place, reviewId: number) {
  return queryKeys.inPlace(place, 'codeReviews', 'subscription', reviewId);
}

/**
 * What the review page's Notifications shows (`subscriptionSection`), or nothing. One `cm codereview subscription` as
 * the page opens, only from a `cm` that has it (`readsReviewSubscriptions`). It hardly changes by itself, so a focus
 * doesn't read it again (`SLOW_CHANGING_QUERY`): writes on a review do (`isAffectedByCodeReviews`), as taking part
 * subscribes the user again, and so does the page's Refresh. A read that fails (a server without the command) shows
 * nothing, and no error: the section is optional.
 */
export function useReviewSubscription(reviewId: number): SubscriptionSection | undefined {
  const place = usePlace();
  const { data: cmVersion } = useQuery(cmVersionQuery);
  const { data } = useQuery({
    queryKey: reviewSubscriptionKey(place, reviewId),
    queryFn: () => api.codeReviews.subscription(place, reviewId),
    enabled: readsReviewSubscriptions(cmVersion),
    ...SLOW_CHANGING_QUERY,
  });
  return subscriptionSection(data);
}
