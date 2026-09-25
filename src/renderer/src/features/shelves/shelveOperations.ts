import type { MergeRequest } from '@shared/domain/merge';
import type { Shelve } from '@shared/domain/shelve';
import { spec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runOperation, runRead, runVoidAction } from '../../app/operations/runOperation';
import { confirm } from '../../ui/dialog/confirm';
import { toast } from '../../ui/toast/toastStore';

/**
 * Applies a shelve to the workspace as a merge from it, never with `cm shelveset apply` (it would open
 * the external merge tool on conflicts). Shelves that conflict open the merge view instead.
 */
export async function applyShelve(workspacePath: string, shelve: Shelve): Promise<void> {
  const request: MergeRequest = { kind: 'merge', sourceSpec: spec.shelve(shelve.id) };
  const plan = await runRead("Couldn't check the shelve", () => api.merge.preview(workspacePath, request));
  if (!plan) return;

  if (plan.status === 'pendingChanges') {
    toast.info(`Shelve ${shelve.id} wasn't applied`, 'Check in, shelve or undo your current changes first, then apply it.');
    return;
  }
  if (plan.status !== 'ready') {
    toast.info(`Shelve ${shelve.id} has nothing new to apply`);
    return;
  }
  if (plan.fileConflicts.length > 0 || plan.directoryConflicts.length > 0) {
    navigation.openPage({ kind: 'merge', request });
    return;
  }

  await runOperation({
    title: `Applying shelve ${shelve.id}`,
    workspacePath,
    run: (operationId) => api.merge.run(workspacePath, request, { directoryConflicts: [], files: {} }, operationId),
    successMessage: () => `Applied shelve ${shelve.id} (${describeCount(plan.changes.length)})`,
    successAction: () => ({ label: 'View changes', run: () => navigation.goToView('changes') }),
  });
}

export function showShelveChanges(shelve: Shelve, focusPath?: string): void {
  navigation.openPage({ kind: 'diff', title: `Shelve ${shelve.id}`, target: { kind: 'shelve', shelveId: shelve.id }, focusPath });
}

export async function deleteShelve(workspacePath: string, shelve: Shelve): Promise<void> {
  const confirmed = await confirm({
    title: `Delete shelve ${shelve.id}?`,
    message: 'The shelved changes will be lost. This cannot be undone.',
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;

  const deleted = await runVoidAction(workspacePath, "Couldn't delete the shelve", () => api.shelves.delete(workspacePath, shelve.id));
  if (deleted) toast.success(`Deleted shelve ${shelve.id}`);
}

function describeCount(files: number): string {
  return files === 1 ? '1 file' : `${files} files`;
}
