import { usePlaceUser } from '../../app/account/accounts';
import type { NavBadge } from '../../ui/nav/navBadgeText';
import { codeReviewsQuery } from './codeReviewFilters';
import { useCodeReviewsViewStore } from './codeReviewsViewStore';
import { useCodeReviews } from './useCodeReviews';
import { waitingBadge } from './waitingForMe';

/**
 * The sidebar's count on Code reviews: the reviews waiting for the user among those the view read, by its filters. It
 * reads nothing itself (`enabled: false`): no `cm find` runs for a sidebar, so the count shows once the view was opened,
 * and follows the list as it's read again.
 */
export function useWaitingForMeBadge(): NavBadge | undefined {
  const me = usePlaceUser();
  const since = useCodeReviewsViewStore((state) => state.since);
  const people = useCodeReviewsViewStore((state) => state.people);
  const status = useCodeReviewsViewStore((state) => state.status);
  const reviewers = useCodeReviewsViewStore((state) => state.reviewers);
  const waitingForMe = useCodeReviewsViewStore((state) => state.waitingForMe);
  const openedByMe = useCodeReviewsViewStore((state) => state.openedByMe);
  const { data } = useCodeReviews(codeReviewsQuery({ since, people, status, reviewers, waitingForMe, openedByMe }), { enabled: false });
  return waitingBadge(data, me);
}
