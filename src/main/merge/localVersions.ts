import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { UpdateConflict } from '@shared/domain/incoming';
import type { CmClient } from '../cm/CmClient';
import { parsePendingChanges } from '../cm/pendingChangesXml';
import { waitForNextSecond } from '../files/nextSecond';
import { retryWhileBusy } from '../files/whileBusy';
import { toAbsolutePath } from '../files/workspacePaths';

/** The local versions of the files an update merges, saved outside the workspace before the update touches them. */
export interface LocalVersions {
  directory: string;
  files: { conflict: UpdateConflict; path: string; saved: string }[];
  /** The files that were checked out: undoing them for the update takes that away. */
  checkedOut: string[];
}

/** Copies each conflicting file into a new folder under `backupsRoot`, and notes which ones are checked out. */
export async function saveLocalVersions(cm: CmClient, workspacePath: string, conflicts: UpdateConflict[], backupsRoot: string): Promise<LocalVersions> {
  const directory = join(backupsRoot, new Date().toISOString().replace(/[:.]/g, '-'));
  const files = conflicts.map((conflict) => ({ conflict, path: toAbsolutePath(workspacePath, conflict.path), saved: toAbsolutePath(directory, conflict.path) }));
  const checkedOutPaths = await readCheckedOutPaths(cm, workspacePath);
  for (const file of files) await copyInto(file.path, file.saved);
  return { directory, files, checkedOut: files.filter((file) => checkedOutPaths.has(file.conflict.path)).map((file) => file.path) };
}

/** Puts every local version back as it was, checked out again where it was, after an undo or update that failed. */
export async function putLocalVersionsBack(cm: CmClient, workspacePath: string, local: LocalVersions): Promise<void> {
  // In a later second than `cm` wrote them, so it sees them changed.
  await waitForNextSecond();
  for (const file of local.files) await copyInto(file.saved, file.path);
  await checkOutAgain(cm, workspacePath, local).catch(() => {
    // The contents are back, as changed files: a checkout refused now (someone took the lock) loses nothing.
  });
}

/** Checks out again the files that were checked out before undoing them. */
export async function checkOutAgain(cm: CmClient, workspacePath: string, local: LocalVersions): Promise<void> {
  if (local.checkedOut.length > 0) await cm.query(['checkout', ...local.checkedOut], { cwd: workspacePath });
}

async function readCheckedOutPaths(cm: CmClient, workspacePath: string): Promise<Set<string>> {
  const xml = await cm.query(['status', '--xml', '--checkout'], { cwd: workspacePath });
  return new Set(parsePendingChanges(xml).changes.map((change) => change.path));
}

/**
 * Copies by rewriting the bytes instead of `copyFile`, which keeps the source's modification time:
 * `cm` detects local changes by timestamp, so a restored file must look freshly modified.
 */
export async function copyInto(source: string, target: string): Promise<void> {
  await mkdir(dirname(target), { recursive: true });
  const content = await readFile(source);
  await retryWhileBusy(() => writeFile(target, content));
}
