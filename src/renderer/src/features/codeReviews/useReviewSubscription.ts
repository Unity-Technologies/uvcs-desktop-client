import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { cmVersionQuery } from '../../app/startup/useCmAvailability';
import { usePlace } from '../../app/workspace/useWorkspace';
import { reviewSubscriptionKey } from './codeReviewKey';
import { asksForSubscription, subscriptionSection, type SubscriptionSection } from './reviewSubscription';

/**
 * What the review page's Notifications shows (`subscriptionSection`), or nothing. One `cm codereview subscription` as
 * the page opens, only from a `cm` that has it. It hardly changes by itself, so a focus doesn't read it again
 * (`SLOW_CHANGING_QUERY`): writes that make the user take part do (`isAffectedByTakingPartInReview`: a comment, a reply,
 * reviewers added, their own status), as the server subscribes them again then, and so does the page's Refresh. A
 * read that fails (a server without the command) shows nothing, and no error, and isn't asked again while it's kept
 * (`asksForSubscription`): the section is optional.
 */
export function useReviewSubscription(reviewId: number): SubscriptionSection | undefined {
  const place = usePlace();
  const { data: cmVersion } = useQuery(cmVersionQuery);
  const { data } = useQuery({
    queryKey: reviewSubscriptionKey(place, reviewId),
    queryFn: () => api.codeReviews.subscription(place, reviewId),
    enabled: (query) => asksForSubscription(cmVersion, query.state.status),
    ...SLOW_CHANGING_QUERY,
  });
  return subscriptionSection(data);
}
