import type { IncomingChanges, IncomingSummary, PartialBranch, UpdateConflict } from '@shared/domain/incoming';
import type { PendingChangesSnapshot } from '@shared/domain/pendingChanges';
import { findUpdateBlockers, findUpdateConflicts, localChangesForUpdateOf } from '@shared/updateCollisions';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { keyedByWorkspaceInfo } from '../../app/queryClient';

/** A workspace loaded from one changeset of its branch, and the head the incoming check last saw there. */
export interface BranchAtHead {
  branch: string;
  loadedChangeset: number;
  headChangeset: number;
}

/**
 * What the incoming changes are read for, as the incoming check tells: part of their query key. At a head, they are
 * read once (`readsOncePerHead`); a partial workspace's are read by its check as its head moves (`checkPartialIncoming`);
 * `offBranch` reads that nothing comes in; `unchecked` reads them anyway while the check fails.
 */
export type IncomingChangesFor = BranchAtHead | PartialBranch | 'offBranch' | 'unchecked';

/** Undefined while the check hasn't answered: a key of its own, read by nothing, so no earlier read shows meanwhile. */
export function incomingChangesKey(workspacePath: string, readFor: IncomingChangesFor | undefined): readonly unknown[] {
  return queryKeys.inWorkspace(workspacePath, 'incoming', 'changes', readFor);
}

/**
 * What the incoming changes are read for from the check's summary; undefined while the check hasn't answered, so they
 * wait for it rather than being read once before and once more under the head it tells.
 */
export function incomingChangesFor(summary: IncomingSummary | undefined, checkFailed: boolean): IncomingChangesFor | undefined {
  if (!summary) return checkFailed ? 'unchecked' : undefined;
  if (!summary.branch) return 'offBranch';
  if ('partial' in summary) return { branch: summary.branch, partial: true };
  return atHead(summary);
}

/** What incoming changes just read are for: the key they're kept under, which the check finds once it sees that head. */
export function incomingChangesReadFor(changes: IncomingChanges): IncomingChangesFor {
  if (!changes.branch) return 'offBranch';
  if ('partial' in changes) return { branch: changes.branch, partial: true };
  return atHead(changes);
}

function atHead({ branch, loadedChangeset, headChangeset }: BranchAtHead): BranchAtHead {
  return { branch, loadedChangeset, headChangeset };
}

/**
 * Whether the incoming changes are read only once for what they're read for: at a head, what came in changes only when
 * the head moves (a new key) or an operation refreshes them. Window focus and mounting never read them again; what
 * collides locally follows the local changes instead (`withLocalCollisions`).
 */
export function readsOncePerHead(readFor: IncomingChangesFor | undefined): boolean {
  return typeof readFor === 'object' && !('partial' in readFor);
}

/**
 * The query of the incoming changes read for `readFor`. At a head, never stale (`readsOncePerHead`), and keyed by the
 * loaded changeset too: an update or a checkin gives it a new key, read as it shows rather than once more under the old
 * one. The other reads keep the default refreshes.
 */
export function incomingChangesQuery(workspacePath: string, readFor: IncomingChangesFor | undefined) {
  const at = readsOncePerHead(readFor);
  return {
    queryKey: incomingChangesKey(workspacePath, readFor),
    queryFn: () => api.merge.incomingChanges(workspacePath),
    // Left out otherwise: an undefined staleTime would replace the default rather than keep it.
    ...(at && { staleTime: Infinity, meta: keyedByWorkspaceInfo('loadedChangeset') }),
  };
}

/** Whether what collides locally is worth checking: something comes in, at a changeset, that changes files. */
function checksLocalCollisions(changes: IncomingChanges | undefined): boolean {
  return Boolean(changes?.branch && !('partial' in changes) && changes.files.length > 0);
}

/** Something read, and when (`dataUpdatedAt`). */
interface Read<T> {
  data: T;
  readAt: number;
}

/**
 * The incoming changes with what they collide with worked out again from Changes' pending changes, when those were
 * read after them: the incoming changes are read once per head, Changes' as the workspace changes. The same object
 * while nothing collides otherwise, so what shows the conflicts doesn't start over. A partial workspace's items say
 * themselves what collides, compared with the head as they were read.
 */
export function withLocalCollisions(incoming: Read<IncomingChanges> | undefined, local: Read<PendingChangesSnapshot> | undefined): IncomingChanges | undefined {
  const changes = incoming?.data;
  if (!changes || !local || local.readAt < incoming.readAt || !checksLocalCollisions(changes) || 'partial' in changes) return changes;
  const localChanges = localChangesForUpdateOf(local.data);
  const conflicts = findUpdateConflicts(changes.files, localChanges);
  const blockedPaths = findUpdateBlockers(changes.files, localChanges);
  if (sameConflicts(conflicts, changes.conflicts) && sameItems(blockedPaths, changes.blockedPaths)) return changes;
  return { ...changes, conflicts, blockedPaths };
}

function sameConflicts(a: UpdateConflict[], b: UpdateConflict[]): boolean {
  return (
    a.length === b.length &&
    a.every((conflict, index) => {
      const other = b[index]!;
      return (
        conflict.path === other.path &&
        conflict.isBinary === other.isBinary &&
        conflict.baseRevisionId === other.baseRevisionId &&
        conflict.incomingRevisionId === other.incomingRevisionId &&
        conflict.repository === other.repository
      );
    })
  );
}

function sameItems(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}
