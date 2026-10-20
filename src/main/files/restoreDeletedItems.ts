import { dirname } from 'node:path';
import type { DeletedItemRestore } from '@shared/domain/explorer';
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
 * each (`cm` takes one item a command), as pending changes. Every item is checked before any is restored: its revision
 * must be of the workspace's repository, as `cm undelete` takes a bare id and would find another item by it there
 * (`undeleteArgs`; the renderer is not trusted to have checked), and its place free with its folder there, as `cm`
 * leaves a refused one half done: an item already at the path fails it at once, but a missing folder fails it only
 * after it wrote the files, left private. Stops at the first failure, and between items once stopped.
 */
export async function restoreDeletedItems(
  workspacePath: string,
  workspaceRepository: string,
  restores: readonly DeletedItemRestore[],
  { cm, exists = pathExists }: ItemRestorer,
  context: Pick<OperationContext, 'signal' | 'reportProgress'>,
): Promise<void> {
  for (const restore of restores) await checkRestore(workspacePath, workspaceRepository, restore, exists);
  for (const [index, restore] of restores.entries()) {
    if (context.signal.aborted) throw new Error('Stopped');
    context.reportProgress('Restoring items', { current: index, total: restores.length });
    await cm(undeleteArgs(workspacePath, restore)).catch((error: unknown) => {
      const refusal = error instanceof CmError ? undeleteRefusal(error.message, restore.path) : null;
      throw refusal === null ? error : (error as CmError).withMessage(refusal);
    });
  }
  context.reportProgress('Restoring items', { current: restores.length, total: restores.length });
}

async function checkRestore(workspacePath: string, workspaceRepository: string, { revision, path }: DeletedItemRestore, exists: (path: string) => Promise<boolean>): Promise<void> {
  if (revision.repository !== workspaceRepository) throw new Error(`${path} is in ${revision.repository}, not in the workspace’s repository: it can’t be restored here.`);
  const target = workspaceFileOf(workspacePath, path);
  if (await exists(target)) throw new Error(placeTaken(path));
  if (!(await exists(dirname(target)))) throw new Error(`${folderOf(path)} isn’t in the workspace. Restore ${path} to another folder.`);
}

/** The folder of a workspace-relative path (forward slashes). */
function folderOf(path: string): string {
  return path.slice(0, Math.max(0, path.lastIndexOf('/')));
}
