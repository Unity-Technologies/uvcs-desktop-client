import { isUnchangedCheckout, type PendingChange, type PendingChangesSnapshot } from '@shared/domain/pendingChanges';
import type { ShelvedChangelist } from '@shared/domain/switchWithChanges';

const isPrivate = (change: PendingChange): boolean => change.kinds.includes('private');

/** The changes a shelve takes: everything but private files. */
export function shelvableChanges(changes: PendingChange[]): PendingChange[] {
  return changes.filter((change) => !isPrivate(change));
}

export interface PendingSummary {
  pendingCount: number;
  privateCount: number;
  unchangedCheckoutsOnly: boolean;
  inMerge: boolean;
}

export function summarizePending(changes: PendingChange[]): PendingSummary {
  const pending = shelvableChanges(changes);
  return {
    pendingCount: pending.length,
    privateCount: changes.length - pending.length,
    unchangedCheckoutsOnly: pending.length > 0 && pending.every(isUnchangedCheckout),
    inMerge: pending.some((change) => change.mergeInfo),
  };
}

/** The pending paths that carry a change, so a shelve holds them. Unchanged checkouts don't: undoing them loses nothing. */
export function changedPaths(changes: PendingChange[]): string[] {
  return shelvableChanges(changes)
    .filter((change) => !isUnchangedCheckout(change))
    .map((change) => change.path);
}

/**
 * The changed paths a shelve lacks, checked against the paths `cm diff sh:N` lists (with the original paths of moves).
 * Any of them means the shelve can't stand in for the changes.
 */
export function missingFromShelve(changes: PendingChange[], shelvedPaths: ReadonlySet<string>): string[] {
  return changedPaths(changes).filter((path) => !shelvedPaths.has(path));
}

/** Items that only exist in the workspace because of the changes: after undoing them they stay on disk as private files. */
export function newItemPaths(changes: PendingChange[]): string[] {
  const paths = changes
    .filter((change) => change.kinds.some((kind) => kind === 'added' || kind === 'copied' || kind === 'locallyMoved'))
    .map((change) => change.path);
  return topmostPaths(paths);
}

/** Drops paths inside other paths of the list: moving a folder moves its contents. */
export function topmostPaths(paths: string[]): string[] {
  const sorted = [...new Set(paths)].sort();
  return sorted.filter((path) => !sorted.some((other) => other !== path && path.startsWith(`${other}/`)));
}

/** The user's changelists and the pending paths in each, to put the changes back where they were. */
export function shelvedChangelists(snapshot: PendingChangesSnapshot): ShelvedChangelist[] {
  return snapshot.changelists
    .map(({ name, description }) => ({
      name,
      description,
      paths: shelvableChanges(snapshot.changes)
        .filter((change) => change.changelist === name)
        .map((change) => change.path),
    }))
    .filter((changelist) => changelist.paths.length > 0);
}
