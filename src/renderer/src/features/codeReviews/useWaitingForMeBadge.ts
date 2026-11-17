import { workspacePathOf } from '@shared/domain/place';
import { usePlaceUser } from '../../app/account/accounts';
import { usePlace } from '../../app/workspace/useWorkspace';
import type { NavBadge } from '../../ui/nav/navBadgeText';
import { usePendingChanges } from '../pendingChanges/usePendingChanges';
import { useCodeReviews } from './useCodeReviews';
import { useCodeReviewsListFilter } from './useCodeReviewsListFilter';
import { badgeReadsReviews, waitingBadge } from './waitingForMe';

/**
 * The sidebar's count on Merge requests: the reviews waiting for the user among those the view reads (`useCodeReviewsListFilter`). It
 * reads that list itself as the window opens, once its first screen is in (`badgeReadsReviews`): one `cm find review`
 * in the time range, which the view then shows without reading it again. Read rarely (`slowChanging`): a focus reads it
 * again only while the view shows it; the review writes and the Refresh button do.
 */
export function useWaitingForMeBadge(): NavBadge | undefined {
  const me = usePlaceUser();
  const hasWorkspace = workspacePathOf(usePlace()) !== null;
  const { isPending: firstScreenPending } = usePendingChanges();
  const enabled = badgeReadsReviews({ hasWorkspace, firstScreenRead: !firstScreenPending });
  const { data } = useCodeReviews(useCodeReviewsListFilter(), { enabled, slowChanging: true });
  return waitingBadge(data, me);
}
