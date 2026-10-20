import { dirname } from 'node:path';
import type { DeletedItemRestore } from '@shared/domain/explorer';
import { undeleteArgs } from '../cm/undeleteArgs';
import type { OperationContext } from '../operations/OperationTracker';
import { pathExists } from './pathExists';
import { workspaceFileOf } from './workspacePaths';

interface ItemRestorer {
  /** Runs a `cm` command in the workspace. */
  cm: (args: string[]) => Promise<unknown>;
  exists?: (path: string) => Promise<boolean>;
}

/**
 * Brings deleted items back, one `cm undelete` each (`cm` takes one item a command, and the user picks each one), as
 * pending changes. Where each goes is checked before any is restored, as `cm` leaves a refused one half done: an item
 * already at the path fails it at once, but a missing folder fails it only after it wrote the files, left private.
 * Stops at the first failure, and between items once stopped.
 */
export async function restoreDeletedItems(
  workspacePath: string,
  restores: readonly DeletedItemRestore[],
  { cm, exists = pathExists }: ItemRestorer,
  context: Pick<OperationContext, 'signal' | 'reportProgress'>,
): Promise<void> {
  for (const restore of restores) await checkPlace(workspacePath, restore, exists);
  for (const [index, restore] of restores.entries()) {
    if (context.signal.aborted) throw new Error('Stopped');
    context.reportProgress('Restoring items', { current: index, total: restores.length });
    await cm(undeleteArgs(workspacePath, restore));
  }
  context.reportProgress('Restoring items', { current: restores.length, total: restores.length });
}

async function checkPlace(workspacePath: string, { path }: DeletedItemRestore, exists: (path: string) => Promise<boolean>): Promise<void> {
  const target = workspaceFileOf(workspacePath, path);
  if (await exists(target)) throw new Error(`${path} is already in the workspace. Restore it to another path.`);
  if (!(await exists(dirname(target)))) throw new Error(`${folderOf(path)} isn’t in the workspace. Restore ${path} to another folder.`);
}

/** The folder of a workspace-relative path (forward slashes). */
function folderOf(path: string): string {
  return path.slice(0, Math.max(0, path.lastIndexOf('/')));
}
