import { useQuery } from '@tanstack/react-query';
import { workspacePathOf } from '@shared/domain/place';
import { usePlaceUser } from '../../app/account/accounts';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { usePlace } from '../../app/workspace/useWorkspace';
import { compactFilter } from '../../lib/compactFilter';
import type { NavBadge } from '../../ui/nav/navBadgeText';
import { usePendingChanges } from '../pendingChanges/usePendingChanges';
import { reviewListSummariesQuery } from './reviewListQueries';
import { useCodeReviewsListFilter } from './useCodeReviewsListFilter';
import { badgeReadsReviews, waitingBadge } from './waitingForMe';

/**
 * The sidebar's count on Merge requests: the reviews waiting for the user among those the view reads
 * (`useCodeReviewsListFilter`). It reads that list itself as the window opens, once its first screen is in
 * (`badgeReadsReviews`): one `cm find review` in the time range, without branch names (`reviewListSummariesQuery`),
 * which the view names when opened while it's fresh (the view's own staleness, thirty seconds). The count reads it
 * rarely (`SLOW_CHANGING_QUERY`): a focus reads it again only while the view shows it; the review writes and the
 * Refresh button do.
 */
export function useWaitingForMeBadge(): NavBadge | undefined {
  const me = usePlaceUser();
  const place = usePlace();
  const hasWorkspace = workspacePathOf(place) !== null;
  const { isPending: firstScreenPending } = usePendingChanges();
  const enabled = badgeReadsReviews({ hasWorkspace, firstScreenRead: !firstScreenPending });
  const { data } = useQuery({
    ...reviewListSummariesQuery(place, compactFilter(useCodeReviewsListFilter())),
    placeholderData: (previous) => previous,
    enabled,
    ...SLOW_CHANGING_QUERY,
  });
  return waitingBadge(data, me);
}
