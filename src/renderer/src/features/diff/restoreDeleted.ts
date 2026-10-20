import type { DeletedItemRestore, RestoreOutcome, RestoreRefusal } from '@shared/domain/explorer';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { viewChangesAction } from '../../app/navigation/viewChangesAction';
import { runOperation } from '../../app/operations/runOperation';
import { isAffectedByRestoredItems } from '../../app/refresh/refreshScopes';
import { fileNameOf, pluralize } from '../../lib/text';
import { confirm } from '../../ui/dialog/confirm';
import { prompt } from '../../ui/dialog/prompt';
import { useToastStore, type ToastAction } from '../../ui/toast/toastStore';
import { useFilesViewStore } from '../files/filesViewStore';
import { itemNameProblem } from '../files/itemName';

/**
 * Items restored without asking first. `cm undelete` takes one item a command, a process each (`runsLong`): a folder
 * row of a tree selects every deleted file under it, and hundreds would be hundreds of commands to the server.
 */
export const MAX_RESTORED_WITHOUT_ASKING = 20;

/**
 * Brings deleted items back as pending changes, as one operation (`cm undelete` each; a folder with all it held, which
 * may download a while), then leads to them in Changes. Several can be stopped between two items; more than
 * `MAX_RESTORED_WITHOUT_ASKING` ask first. A refusal says what came back before it, and what helps (`refusalAction`).
 */
export async function restoreDeletedItems(workspacePath: string, restores: DeletedItemRestore[]): Promise<void> {
  const what = restores.length === 1 ? fileNameOf(restores[0]!.path) : pluralize(restores.length, 'item');
  if (restores.length > MAX_RESTORED_WITHOUT_ASKING && !(await confirmMany(what))) return;
  await runOperation({
    title: `Restoring ${what}`,
    workspacePath,
    run: (operationId) => api.explorer.restoreDeleted(workspacePath, restores, operationId),
    success: (outcome) => {
      if (outcome.refused) return showRefusal(workspacePath, restores, what, outcome, outcome.refused);
      if (outcome.stopped) return { kind: 'info', title: `Restored ${outcome.restored} of ${pluralize(outcome.total, 'item')}`, detail: 'Stopped before the rest', action: viewChangesAction() };
      // Where one came back (it may be elsewhere than it was); several each where they were. No generic count of changes.
      return { title: `Restored ${what}`, detail: restores.length === 1 ? `At ${restores[0]!.path}` : 'Each where it was', action: viewChangesAction() };
    },
    cancellable: restores.length > 1,
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

/**
 * A refusal as an error toast, in place of the operation's card: what came back before it, why, and what helps.
 * Returns null, for the card to go.
 */
function showRefusal(workspacePath: string, restores: DeletedItemRestore[], what: string, outcome: RestoreOutcome, refused: RestoreRefusal): null {
  useToastStore.getState().show({
    kind: 'error',
    title: outcome.restored > 0 ? `Restored ${outcome.restored} of ${pluralize(outcome.total, 'item')}` : `Couldn’t restore ${what}`,
    detail: refused.message,
    action: refusalAction(workspacePath, restores, refused),
  });
  return null;
}

/**
 * What helps after a refusal: another place for an item whose place is taken or whose folder is gone, starting from
 * where it was; the item where the workspace already has it. Nothing for an xlink or another repository's item.
 */
function refusalAction(workspacePath: string, restores: DeletedItemRestore[], refused: RestoreRefusal): ToastAction | undefined {
  const restore = restores.find((each) => each.path === refused.path);
  if ((refused.kind === 'placeTaken' || refused.kind === 'folderMissing') && restore) {
    return { label: 'Restore to…', run: () => void restoreDeletedItemTo(workspacePath, restore) };
  }
  if (refused.kind === 'alreadyLoaded' && refused.loadedPath !== undefined) {
    const loadedPath = refused.loadedPath;
    return {
      label: 'Show in Files',
      run: () => {
        navigation.goToView('files');
        useFilesViewStore.getState().requestReveal(workspacePath, loadedPath);
      },
    };
  }
  return undefined;
}
