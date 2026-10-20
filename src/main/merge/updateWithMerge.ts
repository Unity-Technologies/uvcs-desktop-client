import { copyFile, writeFile } from 'node:fs/promises';
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
 * 1. Back up the local version of every conflicting file (kept afterwards, just in case).
 * 2. Undo those files so the update can proceed, keep a copy of the bases kept (`saveBasesKept`), and update.
 * 3. Write each file's resolution (in a later second than `cm` wrote them: `waitForNextSecond`) and check out again
 *    the files that were checked out.
 * If undoing, saving a base or updating fails, the local versions are put back as they were.
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
    const local = await saveLocalVersions(cm, workspacePath, conflicts, backupsRoot);
    let bases: ReadonlyMap<string, string>;
    try {
      await cm.query(['undo', ...local.files.map((file) => file.path)], { cwd: workspacePath });
      bases = await saveBasesKept(cm, workspacePath, local, resolutions, basesDirectory, context);
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
 * Saves into `directory` the bases kept that the page holds no text of (binaries, text in another encoding), once the
 * conflicting files were undone and before updating: the revision the workspace had loaded, which undoing just wrote
 * back, so it is copied with no download. Only a file undoing left nothing at is downloaded, with one `cm cat` per
 * batch, in a process (binaries run to hundreds of MB). Returns where each was saved, by path; throws when one can't
 * be.
 */
async function saveBasesKept(
  cm: CmClient,
  workspacePath: string,
  local: LocalVersions,
  resolutions: UpdateResolutions,
  directory: string,
  context: OperationContext,
): Promise<Map<string, string>> {
  const kept = local.files.filter(({ conflict }) => {
    const resolution = resolutions[conflict.path]!;
    return resolution.choice === 'base' && resolution.text === undefined;
  });
  if (kept.length === 0) return new Map();

  context.reportProgress('Saving the bases you kept');
  const saved = new Map<string, string>();
  const downloads: (CatRead & { path: string })[] = [];
  for (const [index, { conflict, path }] of kept.entries()) {
    const target = join(directory, `base-${index + 1}`);
    saved.set(conflict.path, target);
    if (await copiedIfThere(path, target)) continue;
    const revision = spec.revision({ revisionId: conflict.baseRevisionId, repository: conflict.repository });
    downloads.push({ path: conflict.path, spec: revision, repository: conflict.repository, target, size: -1 });
  }
  for (const batch of catBatchesOf(downloads, (read) => read)) {
    await cm.execute(catArgs(batch), { cwd: workspacePath, signal: context.signal }).catch((error: unknown) => {
      const files = batch.map((read) => basename(read.path)).join(', ');
      throw new Error(`Couldn't read the base of ${files} to keep it. ${error instanceof Error ? error.message : String(error)}`);
    });
  }
  return saved;
}

/**
 * Copies `source` into `target`, a temp file, without reading it into memory (binaries run to hundreds of MB); false
 * when there's no file at `source`.
 */
async function copiedIfThere(source: string, target: string): Promise<boolean> {
  try {
    await copyFile(source, target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
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
