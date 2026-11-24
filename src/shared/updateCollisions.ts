import type { DiffEntry } from './domain/diff';
import type { UpdateConflict } from './domain/incoming';
import type { ChangeKind, PendingChange, PendingChangesSnapshot } from './domain/pendingChanges';

const LOCAL_CONTENT_CHANGES = new Set(['changed', 'checkedOut', 'replaced']);

/**
 * Local changes to items the branch deleted or moved away: updating can't merge them. A file the branch replaced
 * (`DiffEntry.replaced`) is one: the item changed locally is deleted there, and another took its path.
 */
export function findUpdateBlockers(incoming: DiffEntry[], local: PendingChange[]): string[] {
  const localPaths = new Set(local.map((change) => change.path));
  return incoming
    .filter((entry) => entry.status === 'deleted' || entry.status === 'moved' || entry.replaced)
    .map((entry) => entry.oldPath ?? entry.path)
    .filter((path) => localPaths.has(path));
}

/**
 * Files whose content changed both locally and on the branch: updating has to merge them. A file whose permissions
 * alone changed on the branch brings no content to merge; one it replaced blocks the update (`findUpdateBlockers`).
 */
export function findUpdateConflicts(incoming: DiffEntry[], local: PendingChange[]): UpdateConflict[] {
  const locallyChanged = new Set(
    local.filter((change) => change.kinds.some((kind) => LOCAL_CONTENT_CHANGES.has(kind))).map((change) => change.path),
  );

  return incoming
    .filter((entry) => entry.status === 'changed' && !entry.permissionsChange && !entry.replaced && entry.itemType !== 'directory' && locallyChanged.has(entry.path))
    .map((entry) => ({
      path: entry.path,
      isBinary: entry.itemType === 'binaryFile',
      baseRevisionId: entry.baseRevisionId,
      incomingRevisionId: entry.revisionId,
      repository: entry.repository,
    }));
}

/**
 * The local changes an update can collide with, out of Changes' pending changes: what `cm status --controlledchanged
 * --changed` would print, so the conflicts come out as the incoming read's own, whatever Changes' filter shows.
 * `findUpdateBlockers` takes any local path, so nothing else may be left in. Changes (`pendingChangesStatusOptions`)
 * also asks for local deletes and, by the filter, local moves, private, ignored, cloaked and hidden changed files, each
 * decided on its own:
 * - Deleted on disk only, private or ignored: never printed (Changes lists such an item as that alone, `listedCodes`).
 * - Moved on disk: without `--localmoved`, a checkout moved on disk is a checkout gone from where the workspace has it,
 *   printed there as checked out; anything else moved on disk isn't printed.
 * - Hidden changed: printed only as a checkout (Changes lists a checkout's without the mark).
 * - Cloaked: printed when checked out or changed; the mark only says the update skips it.
 * `--iscochanged` only tells an unchanged checkout (`CO`) from an edited one (`CO+CH`): both are checkouts.
 *
 * One item can't be told: a checkout deleted on disk, which the update's status prints as checked out (it drops only the
 * local delete) and Changes lists only as deleted. It shows no conflict here; updating still checks it, as the Update
 * button and the update itself read the incoming changes again (`readChangesetIncomingChanges`).
 */
export function localChangesForUpdateOf(snapshot: PendingChangesSnapshot): PendingChange[] {
  return snapshot.changes.flatMap((change): PendingChange[] => {
    const has = (kind: ChangeKind) => change.kinds.includes(kind);
    const checkedOut = has('checkedOut');
    if (change.kinds.length === 0 || has('locallyDeleted') || has('private') || has('ignored')) return [];
    if (has('locallyMoved')) return checkedOut && change.oldPath !== undefined ? [checkoutAt(change, change.oldPath)] : [];
    if (has('hiddenChanged') && !checkedOut) return [];
    if (has('cloaked') && !checkedOut && !has('changed')) return [];
    return [change];
  });
}

/** A checkout as the update's status prints it at `path`: checked out, with nothing of a move. */
function checkoutAt({ path: _movedTo, oldPath: _movedFrom, similarityPercent: _similarity, ...change }: PendingChange, path: string): PendingChange {
  return { ...change, path, kinds: ['checkedOut'] };
}
