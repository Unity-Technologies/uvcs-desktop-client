import { useQuery } from '@tanstack/react-query';
import type { Place } from '@shared/domain/place';
import { useSettled } from '../../lib/useSettled';
import { MergeRequestHoverCard } from './MergeRequestHoverCard';
import { asMergeRequest } from './mergeRequestState';
import { MergeRequestStateIcon } from './MergeRequestStateIcon';
import { branchReviewQuery } from './useBranchReviews';

/**
 * A branch's merge request as its state's glyph in its color, quiet where most branches have one (a list of task
 * branches, nearly all Open), hovering it showing the request's summary card (`MergeRequestHoverCard`), whose title opens the request once `leave`
 * closed what holds the list; nothing for a branch without one. Asked once the row stays drawn (`useSettled`), with the other rows in view, in one read
 * (`branchReviewQuery`).
 */
export function BranchMergeRequestMark({ place, branchId, leave }: { place: Place; branchId: number; leave: () => void }) {
  const { data } = useQuery({ ...branchReviewQuery(place, branchId), enabled: useSettled() });
  const request = asMergeRequest(data ?? undefined);
  if (!request) return null;
  return (
    <MergeRequestHoverCard
      request={request}
      beforeOpen={leave}
      trigger={(hoverProps) => (
        <span style={{ display: 'inline-flex', flex: 'none' }} {...hoverProps}>
          <MergeRequestStateIcon mergeRequest={request.mergeRequest} size={13} tip={false} />
        </span>
      )}
    />
  );
}
