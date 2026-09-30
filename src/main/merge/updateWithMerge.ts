import { writeFile } from 'node:fs/promises';
import type { UpdateConflict, UpdateResolutions, UpdateResult } from '@shared/domain/incoming';
import type { CmClient } from '../cm/CmClient';
import { readUpdateProgress } from '../cm/progress/updateProgress';
import { UPDATE_ARGS } from '../cm/updateArgs';
import { waitForNextSecond } from '../files/nextSecond';
import { retryWhileBusy } from '../files/whileBusy';
import type { OperationContext } from '../operations/OperationTracker';
import { readIncomingChanges } from './incoming';
import { checkOutAgain, copyInto, putLocalVersionsBack, saveLocalVersions, type LocalVersions } from './localVersions';

/**
 * Updates a workspace whose local changes collide with incoming ones, without an external merge tool:
 * 1. Back up the local version of every conflicting file (kept afterwards, just in case).
 * 2. Undo those files so the update can proceed, and update.
 * 3. Write each file's resolution (in a later second than `cm` wrote them: `waitForNextSecond`) and check out again
 *    the files that were checked out.
 * If undoing or updating fails, the local versions are put back as they were.
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
  return updateMergingConflicts(cm, workspacePath, conflicts, resolutions, backupsRoot, context);
}

/**
 * `updateWithMerge` once what comes in was read, and nothing blocks the update: `conflicts` are the files changed both
 * locally and on the branch.
 */
export async function updateMergingConflicts(
  cm: CmClient,
  workspacePath: string,
  conflicts: UpdateConflict[],
  resolutions: UpdateResolutions,
  backupsRoot: string,
  context: OperationContext,
): Promise<UpdateResult> {
  const update = (): Promise<string> =>
    cm.execute(UPDATE_ARGS, { cwd: workspacePath, signal: context.signal, onOutputLine: context.progressOf(readUpdateProgress) });

  if (conflicts.length === 0) {
    await update();
    return { backupDirectory: null };
  }

  const unresolved = unresolvedConflicts(conflicts, resolutions);
  if (unresolved.length > 0) throw new Error(`Resolve ${unresolved.map((conflict) => conflict.path).join(', ')} before updating.`);

  context.reportProgress('Saving your local versions');
  const local = await saveLocalVersions(cm, workspacePath, conflicts, backupsRoot);
  try {
    await cm.query(['undo', ...local.files.map((file) => file.path)], { cwd: workspacePath });
    await update();
  } catch (error) {
    await putLocalVersionsBack(cm, workspacePath, local);
    throw new Error(`${error instanceof Error ? error.message : String(error)} Your local changes were put back; nothing was lost.`);
  }

  context.reportProgress('Writing resolved files');
  await writeResolutions(local, resolutions);
  await checkOutAgain(cm, workspacePath, local);
  return { backupDirectory: local.directory };
}

/** The files that need merging to update and have no resolution yet. */
export function unresolvedConflicts(conflicts: UpdateConflict[], resolutions: UpdateResolutions | null): UpdateConflict[] {
  return conflicts.filter((conflict) => !resolutions?.[conflict.path]);
}

/** Each file as decided: the user's text, their own version, or the incoming one the update wrote. */
async function writeResolutions(local: LocalVersions, resolutions: UpdateResolutions): Promise<void> {
  // In a later second than `cm` wrote them: rewritten with as many bytes within that second, they'd look unchanged.
  await waitForNextSecond();
  for (const file of local.files) {
    const resolution = resolutions[file.conflict.path]!;
    if (resolution.choice === 'text') await retryWhileBusy(() => writeFile(file.path, resolution.text, 'utf8'));
    else if (resolution.choice === 'destination') await copyInto(file.saved, file.path);
  }
}
