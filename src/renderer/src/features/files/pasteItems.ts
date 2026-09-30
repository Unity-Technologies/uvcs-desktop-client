import type { ItemMove, TreeItem } from '@shared/domain/explorer';
import { api } from '../../api/client';
import { runOperation } from '../../app/operations/runOperation';
import { isAffectedByFileChangesIn, isAffectedByMovedPaths } from '../../app/refresh/refreshScopes';
import { pluralize } from '../../lib/text';
import { confirm } from '../../ui/dialog/confirm';
import { toast } from '../../ui/toast/toastStore';
import { cutItemsIn, useCutItemsStore } from './cutItemsStore';
import { listedItems, readDirectoryListing } from './directoryListing';
import { useFilesViewStore } from './filesViewStore';
import { parentOf } from './fileTreeRows';
import { folderLabel, pasteFolderFor, planPaste, reverseMoves, type PastePlan } from './pastePlan';

/** What pasting the cut items into the selection would do, from the listings already read (for menus and commands). */
export function pastePlanFor(workspacePath: string, selected: readonly TreeItem[]): PastePlan {
  const folder = pasteFolderFor(selected);
  const names = folder === null ? [] : (listedItems(workspacePath, folder) ?? []).map((item) => item.name);
  return planPaste(cutItemsIn(useCutItemsStore.getState(), workspacePath), folder === null ? null : { path: folder, isPrivate: isPrivateFolder(workspacePath, folder) }, names);
}

/**
 * Moves the cut items into the selected folder (or the selected file's), asking first when some names are taken
 * there; those stay where they are. Then the moved items are selected in their new folder, with Undo.
 */
export async function pasteCutItems(workspacePath: string, selected: readonly TreeItem[]): Promise<void> {
  const folder = pasteFolderFor(selected);
  // The folder's names decide the clashes: read them if it was never opened.
  if (folder !== null) await readDirectoryListing(workspacePath, folder);
  const plan = pastePlanFor(workspacePath, selected);
  if (plan.kind === 'refused') {
    toast.info('Can’t paste here', plan.reason);
    return;
  }
  if (plan.clashes.length > 0 && !(await confirmSkipping(plan.clashes, plan.target, plan.moves.length))) return;

  if (await runMoves(workspacePath, plan.moves, `Moved ${pluralize(plan.moves.length, 'item')}`)) useCutItemsStore.getState().clear();
}

async function runMoves(workspacePath: string, moves: ItemMove[], title: string): Promise<boolean> {
  const folders = [...new Set(moves.flatMap((move) => [parentOf(move.from), parentOf(move.to)]))];
  const moved = await runOperation({
    title: 'Moving items',
    workspacePath,
    run: async (operationId) => {
      await api.explorer.moveItems(workspacePath, moves, operationId);
      return true;
    },
    success: () => ({
      title,
      detail: `To ${folderLabel(parentOf(moves[0]!.to))}`,
      action: { label: 'Undo', run: () => void runMoves(workspacePath, reverseMoves(moves), 'Moved back') },
    }),
    affects: (key) => isAffectedByFileChangesIn(folders)(key) || isAffectedByMovedPaths(key),
  });
  if (!moved) return false;
  useFilesViewStore.getState().requestReveal(moves[0]!.to, moves.map((move) => move.to));
  return true;
}

function confirmSkipping(clashes: string[], target: string, moving: number): Promise<boolean> {
  const one = clashes.length === 1;
  return confirm({
    title: one ? `“${clashes[0]}” is already in ${folderLabel(target)}` : `${clashes.length} names are already in ${folderLabel(target)}`,
    message: one ? 'Nothing is replaced: that item stays where it is.' : `Nothing is replaced: ${clashes.join(', ')} stay where they are.`,
    confirmLabel: `Move ${pluralize(moving, 'item')}`,
  });
}

/** Whether the folder is private, as its parent's listing tells; the root is controlled. */
function isPrivateFolder(workspacePath: string, folder: string): boolean {
  if (folder === '') return false;
  return listedItems(workspacePath, parentOf(folder))?.find((item) => item.path === folder)?.isPrivate ?? false;
}
