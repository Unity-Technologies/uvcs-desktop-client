import { useMemo } from 'react';
import { usePendingChanges, usePendingChangesCount } from '../pendingChanges/usePendingChanges';
import type { PendingChangeset } from './model/layoutGraph';
import { pendingChangesetKey, pendingChangesetOf } from './model/pendingChangeset';

/**
 * The workspace's pending changes as the graph draws them, from the pending changes the app keeps read (the Changes
 * badge reads them anyway, and the watcher refreshes them): no command of its own. The same pending changeset read
 * again is the same object, so the history is laid out again only when it appears, goes or changes what it draws.
 */
export function usePendingChangeset(loadedChangeset: number | null, branch: string | null): { pending: PendingChangeset | null; count: number } {
  const { data: snapshot } = usePendingChanges();
  const read = useMemo(() => pendingChangesetOf(snapshot, loadedChangeset, branch), [snapshot, loadedChangeset, branch]);
  const key = pendingChangesetKey(read);
  // The key names everything `read` holds.
  const pending = useMemo(() => read, [key]);
  return { pending, count: usePendingChangesCount() ?? 0 };
}
