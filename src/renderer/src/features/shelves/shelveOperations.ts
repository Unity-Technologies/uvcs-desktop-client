import type { Shelve } from '@shared/domain/shelve';
import { spec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runAction, runOperation, runVoidAction } from '../../app/operations/runOperation';
import { confirm } from '../../ui/dialog/confirm';
import { toast } from '../../ui/toast/toastStore';

/**
 * Applies a shelve to the workspace. When files changed since it was created, the user is sent
 * to the merge view to resolve the conflicts instead of applying blindly.
 */
export async function applyShelve(workspacePath: string, shelve: Shelve): Promise<void> {
  const preview = await runAction(workspacePath, "Couldn't check the shelve", () => api.shelves.previewApply(workspacePath, shelve.id));
  if (!preview) return;

  if (preview.conflictedPaths.length > 0) {
    const resolve = await confirm({
      title: `Shelve ${shelve.id} has conflicts`,
      message: `${describeCount(preview.conflictedPaths.length)} changed since the shelve was created: ${preview.conflictedPaths.join(', ')}. Resolve them in the merge view?`,
      confirmLabel: 'Resolve conflicts',
    });
    if (resolve) navigation.openPage({ kind: 'merge', request: { kind: 'merge', sourceSpec: spec.shelve(shelve.id) } });
    return;
  }

  await runOperation({
    title: `Applying shelve ${shelve.id}`,
    workspacePath,
    run: (operationId) => api.shelves.apply(workspacePath, shelve.id, operationId),
    successMessage: () => `Applied shelve ${shelve.id} (${describeCount(preview.changedPaths.length)})`,
    successAction: () => ({ label: 'View changes', run: () => navigation.goToView('changes') }),
  });
}

export function showShelveChanges(shelve: Shelve): void {
  navigation.openPage({ kind: 'diff', title: `Shelve ${shelve.id}`, target: { kind: 'shelve', shelveId: shelve.id } });
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
