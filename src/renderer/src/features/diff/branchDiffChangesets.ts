import type { DiffFocusRequest } from './diffFocusRequest';
import type { BranchStart } from '@shared/domain/branch';
import type { Changeset } from '@shared/domain/changeset';
import type { ChangesetSpan } from '../../app/navigation/pages';
import type { ChangesetListFocus } from '../../components/changesetList/changesetStepListModel';

/**
 * Whether the list of changesets shows above a branch diff's files: while they're read, and when there are several. A
 * branch with one changeset has nothing to pick: all its changes are that changeset's, and the header names the branch.
 */
export function showsChangesetList(changesets: readonly Changeset[] | undefined): boolean {
  return changesets === undefined || changesets.length > 1;
}

/**
 * How many of a branch's changesets its diff lists, the newest: every branch diff reads its list as it opens, and a
 * branch as long as /main on a big server holds hundreds of thousands. All its changes stay one row away.
 */
export const BRANCH_CHANGESETS_LIMIT = 1000;

/**
 * The read of a branch's changesets its diff lists, newest first. A review's conversation reads the same (one query
 * key, one `cm find`, `useReviewChangesets`).
 */
export function branchChangesetsFilter(branch: string): { branch: string; limit: number } {
  return { branch, limit: BRANCH_CHANGESETS_LIMIT };
}

/**
 * Where `branch` starts, from its changesets read whole, newest first: the oldest one, and its parent. So the list's
 * menus offer the branch diff up to a changeset with no command, and not on the first changeset. None while the list
 * still shows another branch's changesets, kept while the branch's own are read, nor when it was cut at its `limit`,
 * whose oldest changeset needn't be the branch's first.
 */
export function branchStartOfChangesets(branch: string, changesets: readonly Changeset[] | undefined, limit = BRANCH_CHANGESETS_LIMIT): BranchStart | null {
  const first = changesets?.at(-1);
  if (!changesets || changesets.length >= limit) return null;
  return first && first.branch === branch ? { firstChangeset: first.id, base: first.parent } : null;
}

/**
 * What a branch's diff opens on: the span of changesets asked for (a review's new changesets), the changeset asked for
 * (where a review's comment was written), or else all the branch's changes.
 */
export function initialBranchDiffFocus(focusChangeset: number | undefined, focusChangesets: ChangesetSpan | undefined): ChangesetListFocus {
  if (focusChangesets) return { kind: 'span', span: focusChangesets };
  return focusChangeset === undefined ? { kind: 'all' } : { kind: 'changeset', changesetId: focusChangeset };
}

/**
 * What a branch's diff selects when its place asks while it shows (`DiffFocusRequest`): a span of changesets, a
 * changeset, or all the branch's changes (`changesetId` null); nothing when the request names none (a file alone).
 * A new focus each time, so asking again for the same one selects it again.
 */
export function branchDiffFocusFor(request: Pick<DiffFocusRequest, 'changesetId' | 'changesets'> | null): ChangesetListFocus | null {
  if (request?.changesets) return { kind: 'span', span: request.changesets };
  if (!request || request.changesetId === undefined) return null;
  return request.changesetId === null ? { kind: 'all' } : { kind: 'changeset', changesetId: request.changesetId };
}
