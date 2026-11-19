import type { CodeReview, CodeReviewSummary, MergeRequestInfo } from '@shared/domain/codeReview';
import type { Place } from '@shared/domain/place';
import { api } from '../../api/client';
import { queryClient } from '../../app/queryClient';
import { runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByBranchList, isAffectedByCodeReviews } from '../../app/refresh/refreshScopes';
import type { ChangeableDestination } from './changeableDestination';
import { codeReviewKey } from './codeReviewKey';
import { pickDestination } from './DestinationDialog';
import { showMergeRequestChangedInListsIn } from './listedReview';
import { moveFailureTitle, type MergeRequestMove } from './mergeRequestState';

/**
 * Moves a merge request to another state (`mergeRequestMoves`): one quick `cm mergerequest edit`. Its page and the
 * lists show the new state at once (`showMergeRequestAs`), so the badge doesn't flip back while the reviews are read
 * again. Resolves to whether it moved.
 */
export function setMergeRequestState(place: Place, review: Pick<CodeReviewSummary, 'id'>, move: MergeRequestMove): Promise<boolean> {
  return runVoidAction(
    place,
    moveFailureTitle(move),
    async () => {
      await api.codeReviews.setMergeRequestState(place, review.id, move.to);
      showMergeRequestAs(place, review.id, { state: move.to });
    },
    isAffectedByCodeReviews,
  );
}

/** Makes `branch` the merge request's destination, shown at once as the state is. */
export function setMergeRequestDestination(place: Place, review: Pick<CodeReviewSummary, 'id'>, branch: string): Promise<boolean> {
  return runVoidAction(
    place,
    "Couldn't change the destination",
    async () => {
      await api.codeReviews.setMergeRequestDestination(place, review.id, branch);
      showMergeRequestAs(place, review.id, { destination: branch });
    },
    isAffectedByCodeReviews,
  );
}

/**
 * Asks where the merge request merges, in a dialog with the page's branch list (`pickDestination`), from its row's menu:
 * picking the branch it merges into already, or nothing, changes nothing.
 */
export async function chooseMergeRequestDestination(place: Place, review: Pick<CodeReviewSummary, 'id' | 'title'>, changeable: ChangeableDestination): Promise<void> {
  const picked = await pickDestination({ place, title: review.title, changeable });
  if (picked && picked.name !== changeable.destination) await setMergeRequestDestination(place, review, picked.name);
}

/**
 * Hides a merged request's branch, or shows it again. The branch lists are read again, and the reviews too: a server
 * with merge requests switched on notes it in the request's conversation.
 */
export function setMergedBranchHidden(place: Place, branch: string, hidden: boolean): Promise<boolean> {
  return runVoidAction(
    place,
    hidden ? "Couldn't hide the branch" : "Couldn't unhide the branch",
    () => api.branches.setHidden(place, [branch], hidden),
    (key) => isAffectedByBranchList(key) || isAffectedByCodeReviews(key),
  );
}

/**
 * The review as the server now has it, on its page and in the lists already read, page opened or not (a move from a
 * row's menu), before the refresh `runVoidAction` makes (which marks them to be read again after this), as
 * `setReviewSubscription` does.
 */
function showMergeRequestAs(place: Place, reviewId: number, change: Partial<MergeRequestInfo>): void {
  queryClient.setQueryData<CodeReview>(codeReviewKey(place, reviewId), (shown) => shown?.mergeRequest && { ...shown, mergeRequest: { ...shown.mergeRequest, ...change } });
  showMergeRequestChangedInListsIn(queryClient, place, reviewId, change);
}
