import type { DeletedItemRestore } from '@shared/domain/explorer';
import { api } from '../../api/client';
import { viewChangesAction } from '../../app/navigation/viewChangesAction';
import { runOperation } from '../../app/operations/runOperation';
import { isAffectedByRestoredItems } from '../../app/refresh/refreshScopes';
import { fileNameOf, pluralize } from '../../lib/text';
import { prompt } from '../../ui/dialog/prompt';
import { itemNameProblem } from '../files/itemName';

/**
 * Brings deleted items back as pending changes, as one operation (`cm undelete` each; a folder with all it held, which
 * may download a while), then leads to them in Changes. Several can be stopped between two items.
 */
export async function restoreDeletedItems(workspacePath: string, restores: DeletedItemRestore[]): Promise<void> {
  const what = restores.length === 1 ? fileNameOf(restores[0]!.path) : pluralize(restores.length, 'item');
  await runOperation({
    title: `Restoring ${what}`,
    workspacePath,
    run: (operationId) => api.explorer.restoreDeleted(workspacePath, restores, operationId),
    // Where one came back (it may be elsewhere than it was); several each where they were. No generic count of changes.
    success: () => ({ title: `Restored ${what}`, detail: restores.length === 1 ? `At ${restores[0]!.path}` : 'Each where it was', action: viewChangesAction() }),
    cancellable: restores.length > 1,
    affects: isAffectedByRestoredItems,
  });
}

/** Asks where in the workspace a deleted item comes back (where it was, to start with), and restores it there. */
export async function restoreDeletedItemTo(workspacePath: string, restore: DeletedItemRestore): Promise<void> {
  const path = await prompt({
    title: `Restore ${fileNameOf(restore.path)}`,
    label: 'Path in the workspace',
    initialValue: restore.path,
    acceptInitialValue: true,
    confirmLabel: 'Restore',
    validate: (typed) => itemNameProblem(typed, [], { allowFolders: true }),
  });
  if (!path) return;
  await restoreDeletedItems(workspacePath, [{ ...restore, path: path.trim() }]);
}
