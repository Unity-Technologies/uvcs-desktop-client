import type { GraphChangeset } from '@shared/domain/branchExplorer';
import type { PendingChangesSnapshot } from '@shared/domain/pendingChanges';
import { isControlled } from '../../pendingChanges/changeCategories';
import type { PendingChangeset } from './layoutGraph';

/**
 * The pending changeset to draw, from the pending changes already read: only while the workspace has changes under
 * version control (as the official client, private files alone make no changeset), on the branch the workspace is on.
 */
export function pendingChangesetOf(snapshot: PendingChangesSnapshot | undefined, loadedChangeset: number | null, branch: string | null): PendingChangeset | null {
  if (!snapshot || loadedChangeset === null || branch === null || !snapshot.changes.some(isControlled)) return null;
  return { branch, parent: loadedChangeset, mergeLinks: snapshot.mergeLinks };
}

/** Names what the layout depends on: the same pending changeset read again lays nothing out again. */
export function pendingChangesetKey(pending: PendingChangeset | null): string {
  return pending ? JSON.stringify(pending) : '';
}

/**
 * The branch the workspace's changes go on: the one it is on, or on a label or a changeset, the loaded changeset's
 * branch (null while the history hasn't it).
 */
export function pendingBranchOf(selectedBranch: string | null, loadedChangeset: number | null, changesets: readonly GraphChangeset[] | undefined): string | null {
  if (selectedBranch !== null) return selectedBranch;
  if (loadedChangeset === null) return null;
  return changesets?.find((changeset) => changeset.id === loadedChangeset)?.branch ?? null;
}
