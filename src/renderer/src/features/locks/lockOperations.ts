import type { Place, WorkspacePlace } from '@shared/domain/place';
import type { Lock } from '@shared/domain/lock';
import { api } from '../../api/client';
import { runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByLocks } from '../../app/refresh/refreshScopes';
import { confirm } from '../../ui/dialog/confirm';
import { toast } from '../../ui/toast/toastStore';
import { lockSubject } from './lockSubject';

/** Retained locks are already released; they go away when the change reaches the destination branch. */
export function isReleasable(lock: Lock): boolean {
  return lock.status === 'Locked';
}

/**
 * Whether locks are released or removed from the place: only from a workspace, whose `cm unlock` names the locked
 * items by their paths in it. A repository explored without a workspace shows its locks, and leaves them as they are.
 */
export function unlocksIn(place: Place): place is WorkspacePlace {
  return place.kind === 'workspace';
}

/** Releases the locks so others can check the items out; the lock stays retained until the change reaches its branch. */
export async function releaseLocks(place: WorkspacePlace, locks: Lock[]): Promise<void> {
  const released = await runVoidAction(place, "Couldn't release the lock", () => api.locks.unlock(place.workspacePath, locks, { remove: false }), isAffectedByLocks);
  if (released) toast.success(`Released ${lockSubject(locks)}`);
}

/** Deletes the locks entirely. Only server administrators can do this. */
export async function removeLocks(place: WorkspacePlace, locks: Lock[]): Promise<void> {
  const confirmed = await confirm({
    title: locks.length === 1 ? 'Remove lock?' : `Remove ${locks.length} locks?`,
    message: `This removes ${lockSubject(locks)} even if the changes have not reached the destination branch. Only administrators can remove locks.`,
    confirmLabel: 'Remove',
    danger: true,
  });
  if (!confirmed) return;

  const removed = await runVoidAction(place, "Couldn't remove the lock", () => api.locks.unlock(place.workspacePath, locks, { remove: true }), isAffectedByLocks);
  if (removed) toast.success(`Removed ${lockSubject(locks)}`);
}
