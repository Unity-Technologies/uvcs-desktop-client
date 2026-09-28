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
