import { workspacePlace } from '@shared/domain/place';
import type { DeletedItemRestore, RestoreOutcome, RestoreRefusal } from '@shared/domain/explorer';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { viewChangesAction } from '../../app/navigation/viewChangesAction';
import { runOperation } from '../../app/operations/runOperation';
import { isAffectedByRestoredItems } from '../../app/refresh/refreshScopes';
import { PLATFORM } from '../../lib/platform';
import { fileNameOf, pluralize } from '../../lib/text';
import { confirm } from '../../ui/dialog/confirm';
import { prompt } from '../../ui/dialog/prompt';
import { useToastStore, type ToastAction } from '../../ui/toast/toastStore';
import { useFilesViewStore } from '../files/filesViewStore';
import { restorePathProblem, typedRestorePath } from './restorePath';

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
      if (outcome.stopped && outcome.restored === 0) return { kind: 'info', title: 'Stopped', detail: 'Nothing was restored' };
      if (outcome.stopped) return { kind: 'info', title: `Restored ${outcome.restored} of ${pluralize(outcome.total, 'item')}`, detail: 'Stopped before the rest', action: viewChangesAction() };
      // Where one came back (it may be elsewhere than it was); several each where they were. No generic count of changes.
      return { title: `Restored ${what}`, detail: restores.length === 1 ? `At ${restores[0]!.path}` : 'Each where it was', action: viewChangesAction() };
    },
    cancellable: restores.length > 1,
    affects: isAffectedByRestoredItems,
  });
}

/**
 * Asks where in the workspace a deleted item comes back (where it was, to start with), and restores it there, along
 * with the rest of `restores` (the items a refusal of this one left behind), in their order.
 */
export async function restoreDeletedItemTo(workspacePath: string, restore: DeletedItemRestore, restores: DeletedItemRestore[] = [restore]): Promise<void> {
  const path = await prompt({
    title: `Restore ${fileNameOf(restore.path)}`,
    label: 'Path in the workspace',
    description: 'Into a folder the workspace has, as a pending change.',
    initialValue: restore.path,
    acceptInitialValue: true,
    confirmLabel: 'Restore',
    validate: (typed) => restorePathProblem(typed, PLATFORM),
  });
  if (!path) return;
  const elsewhere = { ...restore, path: typedRestorePath(path, PLATFORM) };
  await restoreDeletedItems(workspacePath, restores.map((each) => (each === restore ? elsewhere : each)));
}

function confirmMany(what: string): Promise<boolean> {
  return confirm({
    title: `Restore ${what}?`,
    message: 'This may take a while.',
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
    action: refusalAction(workspacePath, restores.slice(outcome.restored), refused),
  });
  return null;
}

/**
 * What helps after a refusal: another place for an item whose place is taken or whose folder is gone, starting from
 * where it was; the item where the workspace already has it. Nothing for an xlink or another repository's item.
 */
function refusalAction(workspacePath: string, notRestored: DeletedItemRestore[], refused: RestoreRefusal): ToastAction | undefined {
  const restore = notRestored.find((each) => each.path === refused.path);
  if ((refused.kind === 'placeTaken' || refused.kind === 'folderMissing') && restore) {
    // The rest goes on with it: the refusal stopped them too.
    return { label: 'Restore to…', run: () => void restoreDeletedItemTo(workspacePath, restore, notRestored) };
  }
  if (refused.kind === 'alreadyLoaded' && refused.loadedPath !== undefined) {
    const loadedPath = refused.loadedPath;
    return {
      label: 'Show in Files',
      run: () => {
        navigation.goToView('files');
        useFilesViewStore.getState().requestReveal(workspacePlace(workspacePath), loadedPath);
      },
    };
  }
  return undefined;
}
