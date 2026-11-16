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
  /** The window's workspace: the preview runs in one (`MergeApi.conflictCounts`); null in a repository's window. */
  workspacePath: string | null;
  /** The branch it merges; none when its name couldn't be read. */
  source: string | undefined;
  destination: string;
  /** The source branch's newest changeset, from the changesets the page reads; none until read, or for an empty branch. */
  sourceHead: number | undefined;
}

export interface ConflictsCheckRun extends ConflictsCheckScope {
  /** Whether the request's Conversation tab is shown (`ViewShownContext`). */
  tabShown: boolean;
  /** Whether the user asked for the check on this page (its Check). */
  asked: boolean;
  /** Whether the destination's head was read again since Check: a head kept from earlier may be behind. */
  destinationRead: boolean;
  /** The destination branch's newest changeset; none until read. */
  destinationHead: number | undefined;
}

/** The merge the check previews (`MergeApi.conflictCounts`). */
export interface ConflictsCheckRequest {
  workspacePath: string;
  source: string;
  destination: string;
}

/** What decides what the card shows of the check, once it's asked on this page. */
export interface ConflictsCheckAnswer {
  asked: boolean;
  destinationRead: boolean;
  /** The answer, for the heads the check is keyed by; kept from an earlier check of them too. */
  counts?: MergeConflictCounts;
  /** The preview failed. */
  checkFailed: boolean;
  /** The destination's branch couldn't be read. */
  destinationFailed: boolean;
  /** The destination's branch no longer exists (deleted, renamed). */
  destinationMissing: boolean;
}

/** Whether the card has a conflicts section at all: an open request, in a workspace, of a named branch with changesets. */
export function checksConflicts({ state, workspacePath, source, sourceHead }: ConflictsCheckScope): boolean {
  return state === 'Open' && workspacePath !== null && source !== undefined && sourceHead !== undefined;
}

/** Whether the destination's head is read, for the check's key: once asked, while the conversation is shown. */
export function readsDestinationHead(run: Omit<ConflictsCheckRun, 'destinationRead' | 'destinationHead'>): boolean {
  return checksConflicts(run) && run.tabShown && run.asked;
}

/**
 * The merge to calculate, when it runs: asked, the conversation shown, the destination's head read again since, both
 * heads known. Keyed by both heads and kept, it runs again only when either moves (a check-in on either branch), and
 * once then. None when it doesn't run.
 */
export function conflictsCheckRequest(run: ConflictsCheckRun): ConflictsCheckRequest | undefined {
  const { workspacePath, source, destination } = run;
  if (!readsDestinationHead(run) || !run.destinationRead || run.destinationHead === undefined) return undefined;
  if (workspacePath === null || source === undefined) return undefined;
  return { workspacePath, source, destination };
}

/**
 * What the card shows: Check until asked on this page, even with an answer or a failure kept from an earlier visit (the
 * branches may have moved since, and Check asks again); then checking while the destination's head is read again and
 * the merge calculated; then the answer, or a failure.
 */
export function conflictsCheckOf({ asked, destinationRead, counts, checkFailed, destinationFailed, destinationMissing }: ConflictsCheckAnswer): ConflictsCheck {
  if (!asked) return { kind: 'unchecked' };
  if (!destinationRead) return { kind: 'checking' };
  if (destinationFailed || destinationMissing) return { kind: 'failed' };
  if (counts) return { kind: 'checked', counts };
  if (checkFailed) return { kind: 'failed' };
  return { kind: 'checking' };
}
