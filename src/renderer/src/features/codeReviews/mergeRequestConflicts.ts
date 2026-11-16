import type { MergeRequestState } from '@shared/domain/codeReview';
import type { MergeConflictCounts } from '@shared/domain/merge';

/**
 * Where the check of an open merge request's conflicts with its destination stands, as its card shows it
 * (`conflictsSectionOf`). The check is a merge calculated on the server, over a second on a big repository, so it runs
 * only when asked (docs/features/merge-requests.md "Conflicts with the destination").
 */
export type ConflictsCheck =
  | { kind: 'unchecked' }
  | { kind: 'checking' }
  | { kind: 'checked'; counts: MergeConflictCounts }
  | { kind: 'failed' };

export interface ConflictsCheckScope {
  state: MergeRequestState;
  /** Whether the window has a workspace: the preview runs in one (`MergeApi.conflictCounts`). */
  inWorkspace: boolean;
  /** The source branch's newest changeset, from the changesets the page reads; none until read, or for an empty branch. */
  sourceHead: number | undefined;
}

export interface ConflictsCheckRun extends ConflictsCheckScope {
  /** Whether the request's Conversation tab is shown (`ViewShownContext`). */
  tabShown: boolean;
  /** Whether the user asked for the check on this page (its Check). */
  asked: boolean;
  /** The destination branch's newest changeset; none until read. */
  destinationHead: number | undefined;
}

/** Whether the card has a conflicts section at all: an open request, in a workspace, of a branch with changesets. */
export function checksConflicts({ state, inWorkspace, sourceHead }: ConflictsCheckScope): boolean {
  return state === 'Open' && inWorkspace && sourceHead !== undefined;
}

/** Whether the destination's head is read, for the check's key: once asked, while the conversation is shown. */
export function readsDestinationHead(run: Omit<ConflictsCheckRun, 'destinationHead'>): boolean {
  return checksConflicts(run) && run.tabShown && run.asked;
}

/**
 * Whether the merge is calculated: asked, the conversation shown, both heads known. Keyed by both heads and kept, it
 * runs again only when either moves (a check-in on either branch), and once then.
 */
export function runsConflictsCheck(run: ConflictsCheckRun): boolean {
  return readsDestinationHead(run) && run.destinationHead !== undefined;
}

/** What the card shows: the answer when there is one (kept from an earlier check of the same heads too), else where the asking stands. */
export function conflictsCheckOf({ asked, counts, failed }: { asked: boolean; counts?: MergeConflictCounts; failed: boolean }): ConflictsCheck {
  if (counts) return { kind: 'checked', counts };
  if (failed) return { kind: 'failed' };
  return asked ? { kind: 'checking' } : { kind: 'unchecked' };
}
