import type { DiffEntry } from './domain/diff';
import type { UpdateConflict } from './domain/incoming';
import type { PendingChange } from './domain/pendingChanges';

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
