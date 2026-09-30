import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import { api } from '../../api/client';
import { runAction, runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByWorkspaceState } from '../../app/refresh/refreshScopes';
import { pluralize } from '../../lib/text';
import { confirm } from '../../ui/dialog/confirm';
import { prompt } from '../../ui/dialog/prompt';
import { toast } from '../../ui/toast/toastStore';
import { DEFAULT_CHANGELIST_LABEL } from './changeRows';

/**
 * Only added and checked-out items can live in a changelist, so locally changed files are checked out first. Changelists
 * live in the workspace: they change only its pending changes, unless a checkout (which may take a lock) came first.
 */
export async function moveToChangelist(workspacePath: string, changelist: string | null, changes: PendingChange[]): Promise<void> {
  const needsCheckout = changes.filter((change) => change.kinds.includes('changed') && !change.kinds.includes('checkedOut'));
  const moved = await runVoidAction(
    workspacePath,
    "Couldn't move the changes",
    async () => {
      if (needsCheckout.length > 0) await api.pendingChanges.checkout(workspacePath, needsCheckout.map((change) => change.path));
      await api.pendingChanges.moveToChangelist(workspacePath, changelist, changes.map((change) => change.path));
    },
    needsCheckout.length > 0 ? undefined : isAffectedByWorkspaceState,
  );
  if (moved) toast.success(`Moved ${pluralize(changes.length, 'change')} to ${changelist ?? DEFAULT_CHANGELIST_LABEL}`);
}

export async function moveToNewChangelist(workspacePath: string, changes: PendingChange[]): Promise<void> {
  const name = await prompt({ title: 'New changelist', label: 'Name', confirmLabel: 'Create' });
  if (!name) return;

  const created = await runVoidAction(
    workspacePath,
    "Couldn't create the changelist",
    () => api.pendingChanges.createChangelist(workspacePath, { name, description: '' }),
    isAffectedByWorkspaceState,
  );
  if (created && changes.length > 0) await moveToChangelist(workspacePath, name, changes);
}

export async function renameChangelist(workspacePath: string, changelist: Changelist): Promise<void> {
  const name = await prompt({ title: 'Rename changelist', label: 'Name', initialValue: changelist.name, confirmLabel: 'Rename' });
  if (!name) return;
  await runAction(
    workspacePath,
    "Couldn't rename the changelist",
    () => api.pendingChanges.editChangelist(workspacePath, changelist.name, { ...changelist, name }),
    isAffectedByWorkspaceState,
  );
}

export async function editChangelistDescription(workspacePath: string, changelist: Changelist): Promise<void> {
  const description = await prompt({
    title: `Describe “${changelist.name}”`,
    label: 'Description',
    initialValue: changelist.description,
    confirmLabel: 'Save',
  });
  if (!description) return;
  await runAction(
    workspacePath,
    "Couldn't update the changelist",
    () => api.pendingChanges.editChangelist(workspacePath, changelist.name, { ...changelist, description }),
    isAffectedByWorkspaceState,
  );
}

export async function deleteChangelist(workspacePath: string, changelist: Changelist): Promise<void> {
  const confirmed = await confirm({
    title: `Delete changelist “${changelist.name}”?`,
    message: 'Its changes are kept and move to the default changelist.',
    confirmLabel: 'Delete changelist',
    danger: true,
  });
  if (!confirmed) return;
  await runAction(workspacePath, "Couldn't delete the changelist", () => api.pendingChanges.deleteChangelist(workspacePath, changelist.name), isAffectedByWorkspaceState);
}
