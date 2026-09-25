import type { Lock } from '@shared/domain/lock';
import { api } from '../../api/client';
import { runAction } from '../../app/operations/runOperation';
import { confirm } from '../../ui/dialog/confirm';
import { toast } from '../../ui/toast/toastStore';

function describe(locks: Lock[]): string {
  return locks.length === 1 ? locks[0]!.path : `${locks.length} locks`;
}

/** Releases the locks so others can check the items out; the lock stays retained until the change reaches its branch. */
export async function releaseLocks(workspacePath: string, locks: Lock[]): Promise<void> {
  const released = await runAction(workspacePath, "Couldn't release the lock", async () => {
    await api.locks.unlock(workspacePath, locks, { remove: false });
    return true;
  });
  if (released) toast.success(`Released ${describe(locks)}`);
}

/** Deletes the locks entirely. Only server administrators can do this. */
export async function removeLocks(workspacePath: string, locks: Lock[]): Promise<void> {
  const confirmed = await confirm({
    title: `Remove ${describe(locks)}?`,
    message: 'Removing a lock discards it completely, even if its changes have not reached the destination branch. Only administrators can do this.',
    confirmLabel: 'Remove',
    danger: true,
  });
  if (!confirmed) return;

  const removed = await runAction(workspacePath, "Couldn't remove the lock", async () => {
    await api.locks.unlock(workspacePath, locks, { remove: true });
    return true;
  });
  if (removed) toast.success(`Removed ${describe(locks)}`);
}
