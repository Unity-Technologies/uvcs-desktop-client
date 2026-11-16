import { useQuery } from '@tanstack/react-query';
import type { Place } from '@shared/domain/place';
import { useSettled } from '../../lib/useSettled';
import { MergeRequestHoverCard } from './MergeRequestHoverCard';
import { asMergeRequest } from './mergeRequestState';
import { MergeRequestStateBadge } from './MergeRequestStateBadge';
import { branchReviewQuery } from './useBranchReviews';

/**
 * A branch's merge request as its state's compact pill ("Merged"), as the top bar and the Branches view show it,
 * hovering it showing the request's summary card (`MergeRequestHoverCard`), its title not a link here; nothing for a
 * branch without one. Asked once the row stays drawn (`useSettled`), with the other rows in view, in one read
 * (`branchReviewQuery`).
 */
export function BranchMergeRequestMark({ place, branchId }: { place: Place; branchId: number }) {
  const { data } = useQuery({ ...branchReviewQuery(place, branchId), enabled: useSettled() });
  const request = asMergeRequest(data ?? undefined);
  if (!request) return null;
  return (
    <MergeRequestHoverCard
      request={request}
      // The list is for picking: a page opened from its card would sit under the popup or dialog that holds it.
      opens={false}
      trigger={(hoverProps) => (
        <span style={{ display: 'inline-flex', flex: 'none' }} {...hoverProps}>
          <MergeRequestStateBadge state={request.mergeRequest.state} compact />
        </span>
      )}
    />
  );
}
