import { dirname } from 'node:path';
import type { DeletedItemRestore, RestoreOutcome, RestoreRefusal } from '@shared/domain/explorer';
import { CmError } from '../cm/CmError';
import { undeleteArgs } from '../cm/undeleteArgs';
import { placeTaken, undeleteRefusal } from '../cm/undeleteRefusal';
import type { OperationContext } from '../operations/OperationTracker';
import { pathExists } from './pathExists';
import { workspaceFileOf } from './workspacePaths';

interface ItemRestorer {
  /** Runs a `cm` command in the workspace. */
  cm: (args: string[]) => Promise<unknown>;
  exists?: (path: string) => Promise<boolean>;
}

/**
 * Brings deleted items of the workspace's repository (`workspaceRepository`, `name@server`) back, one `cm undelete`
 * each (`cm` takes one item a command), as pending changes, and tells how many came back and what stopped the rest.
 * Every item is checked before any is restored: its revision must be of the workspace's repository, as `cm undelete`
 * takes a bare id and would find another item by it there (`undeleteArgs`; the renderer is not trusted to have
 * checked), and its place free with its folder there, as `cm` leaves a refused one half done: an item already at the
 * path fails it at once, but a missing folder fails it only after it wrote the files, left private. Stops at the first
 * refusal (`undeleteRefusal`), and between items once stopped; any other failure fails it, as `cm` tells it.
 */
export async function restoreDeletedItems(
  workspacePath: string,
  workspaceRepository: string,
  restores: readonly DeletedItemRestore[],
  { cm, exists = pathExists }: ItemRestorer,
  context: Pick<OperationContext, 'signal' | 'reportProgress'>,
): Promise<RestoreOutcome> {
  const total = restores.length;
  for (const restore of restores) {
    const refused = await checkRestore(workspacePath, workspaceRepository, restore, exists);
    if (refused) return { restored: 0, total, refused };
  }
  for (const [index, restore] of restores.entries()) {
    if (context.signal.aborted) return { restored: index, total, stopped: true };
    context.reportProgress('Restoring items', { current: index, total });
    try {
      await cm(undeleteArgs(workspacePath, restore));
    } catch (error) {
      const refused = error instanceof CmError ? undeleteRefusal(error.message, restore.path) : null;
      if (!refused) throw error;
      return { restored: index, total, refused };
    }
  }
  context.reportProgress('Restoring items', { current: total, total });
  return { restored: total, total };
}

async function checkRestore(
  workspacePath: string,
  workspaceRepository: string,
  { revision, path }: DeletedItemRestore,
  exists: (path: string) => Promise<boolean>,
): Promise<RestoreRefusal | null> {
  if (revision.repository !== workspaceRepository) {
    return { kind: 'otherRepository', path, message: `${path} is in ${revision.repository}, not in the workspace’s repository: it can’t be restored here.` };
  }
  const target = workspaceFileOf(workspacePath, path);
  if (await exists(target)) return placeTaken(path);
  if (!(await exists(dirname(target)))) return { kind: 'folderMissing', path, message: `${folderOf(path)} isn’t in the workspace. Restore ${path} to another folder.` };
  return null;
}

/** The folder of a workspace-relative path (forward slashes). */
function folderOf(path: string): string {
  return path.slice(0, Math.max(0, path.lastIndexOf('/')));
}
