import { writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { UpdateConflict, UpdateResolutions, UpdateResult } from '@shared/domain/incoming';
import { spec } from '@shared/domain/specs';
import { catArgs, catBatchesOf, type CatRead } from '../cm/catBatches';
import type { CmClient } from '../cm/CmClient';
import { readUpdateProgress } from '../cm/progress/updateProgress';
import { UPDATE_ARGS } from '../cm/updateArgs';
import { waitForNextSecond } from '../files/nextSecond';
import { withTempDirectory } from '../files/tempFile';
import { retryWhileBusy } from '../files/whileBusy';
import type { OperationContext } from '../operations/OperationTracker';
import { readIncomingChanges } from './incoming';
import { checkOutAgain, copyInto, putLocalVersionsBack, saveLocalVersions, type LocalVersions } from './localVersions';

/**
 * Updates a workspace whose local changes collide with incoming ones, without an external merge tool:
 * 1. Save the bases kept the page holds no text of, and back up the local version of every conflicting file (kept
 *    afterwards, just in case).
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

  return withTempDirectory(async (basesDirectory) => {
    context.reportProgress('Saving your local versions');
    const bases = await saveBasesKept(cm, workspacePath, conflicts, resolutions, basesDirectory, context.signal);
    const local = await saveLocalVersions(cm, workspacePath, conflicts, backupsRoot);
    try {
      await cm.query(['undo', ...local.files.map((file) => file.path)], { cwd: workspacePath });
      await update();
    } catch (error) {
      await putLocalVersionsBack(cm, workspacePath, local);
      throw new Error(`${error instanceof Error ? error.message : String(error)} Your local changes were put back; nothing was lost.`);
    }

    context.reportProgress('Writing resolved files');
    await writeResolutions(local, resolutions, bases);
    await checkOutAgain(cm, workspacePath, local);
    return { backupDirectory: local.directory };
  });
}

/**
 * Saves into `directory` the bases kept that the page holds no text of (binaries, text in another encoding): the
 * revision the workspace had loaded, which no file on disk holds once changed. One `cm cat` per batch, in a process
 * (binaries run to hundreds of MB), before anything changes: a base that can't be read stops the update. Returns
 * where each was saved, by path.
 */
async function saveBasesKept(
  cm: CmClient,
  workspacePath: string,
  conflicts: UpdateConflict[],
  resolutions: UpdateResolutions,
  directory: string,
  signal: AbortSignal,
): Promise<Map<string, string>> {
  const reads = conflicts
    .filter((conflict) => {
      const resolution = resolutions[conflict.path]!;
      return resolution.choice === 'base' && resolution.text === undefined;
    })
    .map((conflict, index): CatRead & { path: string } => ({
      path: conflict.path,
      spec: spec.revision({ revisionId: conflict.baseRevisionId, repository: conflict.repository }),
      repository: conflict.repository,
      target: join(directory, `base-${index + 1}`),
      size: -1,
    }));
  for (const batch of catBatchesOf(reads, (read) => read)) {
    await cm.execute(catArgs(batch), { cwd: workspacePath, signal }).catch((error: unknown) => {
      const files = batch.map((read) => basename(read.path)).join(', ');
      throw new Error(`Couldn't read the base of ${files} to keep it, so nothing was updated. ${error instanceof Error ? error.message : String(error)}`);
    });
  }
  return new Map(reads.map((read) => [read.path, read.target]));
}

/** The files that need merging to update and have no resolution yet. */
export function unresolvedConflicts(conflicts: UpdateConflict[], resolutions: UpdateResolutions | null): UpdateConflict[] {
  return conflicts.filter((conflict) => !resolutions?.[conflict.path]);
}

/**
 * Each file as decided: the user's text, their own version, the incoming one the update wrote, or the base, as read or
 * as saved before updating (`bases`, by path).
 */
async function writeResolutions(local: LocalVersions, resolutions: UpdateResolutions, bases: ReadonlyMap<string, string>): Promise<void> {
  // In a later second than `cm` wrote them: rewritten with as many bytes within that second, they'd look unchanged.
  await waitForNextSecond();
  for (const file of local.files) {
    const resolution = resolutions[file.conflict.path]!;
    if (resolution.choice === 'text') await retryWhileBusy(() => writeFile(file.path, resolution.text, 'utf8'));
    else if (resolution.choice === 'destination') await copyInto(file.saved, file.path);
    else if (resolution.choice === 'base') {
      const { text } = resolution;
      if (text !== undefined) await retryWhileBusy(() => writeFile(file.path, text, 'utf8'));
      else await copyInto(bases.get(file.conflict.path)!, file.path);
    }
  }
}
