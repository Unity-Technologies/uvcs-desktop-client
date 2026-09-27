import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { UpdateConflict, UpdateResolutions, UpdateResult } from '@shared/domain/incoming';
import type { CmClient } from '../cm/CmClient';
import { parsePendingChanges } from '../cm/pendingChangesXml';
import { readUpdateProgress } from '../cm/progress/updateProgress';
import { UPDATE_ARGS } from '../cm/updateArgs';
import { waitForNextSecond } from '../files/nextSecond';
import { toAbsolutePath } from '../files/workspacePaths';
import type { OperationContext } from '../operations/OperationTracker';
import { readIncomingChanges } from './incoming';

/**
 * Updates a workspace whose local changes collide with incoming ones, without an external merge tool:
 * 1. Back up the local version of every conflicting file (kept afterwards, just in case).
 * 2. Undo those files so the update can proceed, and update.
 * 3. Write each file's resolution (in a later second than `cm` wrote them: `waitForNextSecond`) and check out again
 *    the files that were checked out.
 * If the update fails, the local versions are put back as they were.
 */
export async function updateWithMerge(
  cm: CmClient,
  workspacePath: string,
  resolutions: UpdateResolutions,
  backupsRoot: string,
  context: OperationContext,
): Promise<UpdateResult> {
  const { conflicts, blockedPaths } = await readIncomingChanges(cm, workspacePath);
  if (blockedPaths.length > 0) throw new Error(`Check in, shelve or undo your changes to ${blockedPaths.join(', ')} first: the branch deleted or moved them.`);
  const update = (): Promise<string> =>
    cm.execute(UPDATE_ARGS, { cwd: workspacePath, signal: context.signal, onOutputLine: context.progressOf(readUpdateProgress) });

  if (conflicts.length === 0) {
    await update();
    return { backupDirectory: null };
  }

  const unresolved = unresolvedConflicts(conflicts, resolutions);
  if (unresolved.length > 0) throw new Error(`Resolve ${unresolved.map((conflict) => conflict.path).join(', ')} before updating.`);

  const backupDirectory = join(backupsRoot, new Date().toISOString().replace(/[:.]/g, '-'));
  const checkedOutPaths = await readCheckedOutPaths(cm, workspacePath);
  const absolute = (conflict: UpdateConflict): string => toAbsolutePath(workspacePath, conflict.path);
  const backup = (conflict: UpdateConflict): string => toAbsolutePath(backupDirectory, conflict.path);

  context.reportProgress('Saving your local versions');
  for (const conflict of conflicts) await copyInto(absolute(conflict), backup(conflict));

  await cm.query(['undo', ...conflicts.map(absolute)], { cwd: workspacePath });
  try {
    await update();
  } catch (error) {
    await waitForNextSecond();
    for (const conflict of conflicts) await copyInto(backup(conflict), absolute(conflict));
    throw new Error(`${error instanceof Error ? error.message : String(error)} Your local changes were put back; nothing was lost.`);
  }

  context.reportProgress('Writing resolved files');
  await waitForNextSecond();
  for (const conflict of conflicts) {
    const resolution = resolutions[conflict.path]!;
    if (resolution.choice === 'text') await writeFile(absolute(conflict), resolution.text, 'utf8');
    else if (resolution.choice === 'destination') await copyInto(backup(conflict), absolute(conflict));
  }

  const toCheckOut = conflicts.filter((conflict) => checkedOutPaths.has(conflict.path)).map(absolute);
  if (toCheckOut.length > 0) await cm.query(['checkout', ...toCheckOut], { cwd: workspacePath });

  return { backupDirectory };
}

/** The files that need merging to update and have no resolution yet. */
export function unresolvedConflicts(conflicts: UpdateConflict[], resolutions: UpdateResolutions | null): UpdateConflict[] {
  return conflicts.filter((conflict) => !resolutions?.[conflict.path]);
}

async function readCheckedOutPaths(cm: CmClient, workspacePath: string): Promise<Set<string>> {
  const xml = await cm.query(['status', '--xml', '--checkout'], { cwd: workspacePath });
  return new Set(parsePendingChanges(xml).changes.map((change) => change.path));
}

/**
 * Copies by rewriting the bytes instead of `copyFile`, which keeps the source's modification time:
 * `cm` detects local changes by timestamp, so a restored file must look freshly modified.
 */
async function copyInto(source: string, target: string): Promise<void> {
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, await readFile(source));
}
