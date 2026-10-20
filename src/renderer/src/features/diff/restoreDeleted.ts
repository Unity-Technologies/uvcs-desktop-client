import type { DeletedItemRestore } from '@shared/domain/explorer';
import { api } from '../../api/client';
import { viewChangesAction } from '../../app/navigation/viewChangesAction';
import { runOperation } from '../../app/operations/runOperation';
import { isAffectedByRestoredItems } from '../../app/refresh/refreshScopes';
import { fileNameOf, pluralize } from '../../lib/text';
import { confirm } from '../../ui/dialog/confirm';
import { prompt } from '../../ui/dialog/prompt';
import { useToastStore } from '../../ui/toast/toastStore';
import { itemNameProblem } from '../files/itemName';

/**
 * Items restored without asking first. `cm undelete` takes one item a command, a process each (`runsLong`): a folder
 * row of a tree selects every deleted file under it, and hundreds would be hundreds of commands to the server.
 */
export const MAX_RESTORED_WITHOUT_ASKING = 20;

/**
 * Brings deleted items back as pending changes, as one operation (`cm undelete` each; a folder with all it held, which
 * may download a while), then leads to them in Changes. Several can be stopped between two items; more than
 * `MAX_RESTORED_WITHOUT_ASKING` ask first. A refused item offers "Restore to…".
 */
export async function restoreDeletedItems(workspacePath: string, restores: DeletedItemRestore[]): Promise<void> {
  const what = restores.length === 1 ? fileNameOf(restores[0]!.path) : pluralize(restores.length, 'item');
  if (restores.length > MAX_RESTORED_WITHOUT_ASKING && !(await confirmMany(what))) return;
  await runOperation({
    title: `Restoring ${what}`,
    workspacePath,
    run: (operationId) => api.explorer.restoreDeleted(workspacePath, restores, operationId),
    // Where one came back (it may be elsewhere than it was); several each where they were. No generic count of changes.
    success: () => ({ title: `Restored ${what}`, detail: restores.length === 1 ? `At ${restores[0]!.path}` : 'Each where it was', action: viewChangesAction() }),
    cancellable: restores.length > 1,
    onFailure: (error) => {
      showRefusal(workspacePath, restores, what, error);
      return true;
    },
    affects: isAffectedByRestoredItems,
  });
}

/** Asks where in the workspace a deleted item comes back (where it was, to start with), and restores it there. */
export async function restoreDeletedItemTo(workspacePath: string, restore: DeletedItemRestore): Promise<void> {
  const path = await prompt({
    title: `Restore ${fileNameOf(restore.path)}`,
    label: 'Path in the workspace',
    description: 'Into a folder the workspace has, as a pending change.',
    initialValue: restore.path,
    acceptInitialValue: true,
    confirmLabel: 'Restore',
    validate: restorePathProblem,
  });
  if (!path) return;
  await restoreDeletedItems(workspacePath, [{ ...restore, path: path.trim() }]);
}

/** Why a typed path can't take a restored item, as far as the renderer can tell: main checks the disk. */
function restorePathProblem(path: string): string | undefined {
  if (path.trim().startsWith('/')) return 'A path in the workspace starts with a folder or a name, not “/”';
  return itemNameProblem(path, [], { allowFolders: true });
}

function confirmMany(what: string): Promise<boolean> {
  return confirm({
    title: `Restore ${what}?`,
    message: 'Each comes back with a command of its own, which takes a while for this many.',
    confirmLabel: `Restore ${what}`,
  });
}

/** The failure, and for one item the way left: restoring it somewhere else, starting from where it was. */
function showRefusal(workspacePath: string, restores: DeletedItemRestore[], what: string, error: unknown): void {
  const single = restores.length === 1 ? restores[0]! : null;
  useToastStore.getState().show({
    kind: 'error',
    title: `Couldn’t restore ${what}`,
    detail: error instanceof Error ? error.message : undefined,
    error,
    action: single ? { label: 'Restore to…', run: () => void restoreDeletedItemTo(workspacePath, single) } : undefined,
  });
}
