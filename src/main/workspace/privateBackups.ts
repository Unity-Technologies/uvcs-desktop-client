import { cp, mkdir, readdir, readFile, rename, rm, rmdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { KeptAsideFile } from '@shared/domain/switchWithChanges';
import { retryWhileBusy } from '../files/whileBusy';
import { toAbsolutePath } from '../files/workspacePaths';

/** Moves workspace items (workspace-relative paths) into `directory`, keeping their relative paths. */
export async function moveAside(workspacePath: string, paths: string[], directory: string): Promise<void> {
  for (const path of paths) await move(toAbsolutePath(workspacePath, path), toAbsolutePath(directory, path));
}

/**
 * Moves the items back into the workspace. Where the workspace has an item again in the meantime (the shelve brought
 * the added file back, a private file took its place), a folder is put back item by item and a file with the same
 * content is dropped: the workspace already has it. Anything else is not overwritten: it stays in the backup.
 * Resolves to what stayed there (the backup folder is gone when nothing did).
 */
export async function putBack(workspacePath: string, backup: { directory: string; paths: string[] }): Promise<KeptAsideFile[]> {
  const kept: KeptAsideFile[] = [];
  for (const path of backup.paths) kept.push(...(await putItemBack(backup.directory, workspacePath, path)));
  if (kept.length === 0) await rm(backup.directory, { recursive: true, force: true });
  return kept;
}

/** Puts the item at `path` (workspace-relative) back; resolves to what of it stayed in the backup. */
async function putItemBack(backupDirectory: string, workspacePath: string, path: string): Promise<KeptAsideFile[]> {
  const source = toAbsolutePath(backupDirectory, path);
  const target = toAbsolutePath(workspacePath, path);
  const sourceStats = await stat(source).catch(() => undefined);
  if (!sourceStats) return [];
  const targetStats = await stat(target).catch(() => undefined);
  if (!targetStats) {
    await move(source, target);
    return [];
  }
  if (sourceStats.isDirectory() && targetStats.isDirectory()) {
    const kept: KeptAsideFile[] = [];
    for (const name of await readdir(source)) kept.push(...(await putItemBack(backupDirectory, workspacePath, `${path}/${name}`)));
    if (kept.length === 0) await rmdir(source);
    return kept;
  }
  if (sourceStats.isFile() && targetStats.isFile() && (await sameContent(source, target))) {
    await rm(source);
    return [];
  }
  return [{ path, savedAt: source }];
}

async function sameContent(a: string, b: string): Promise<boolean> {
  const [first, second] = await Promise.all([readFile(a), readFile(b)]);
  return first.equals(second);
}

/** A file open in another program (an editor, the Unity Editor) blocks moving it on Windows for a while: tried again. */
async function move(source: string, target: string): Promise<void> {
  await mkdir(dirname(target), { recursive: true });
  try {
    await retryWhileBusy(() => rename(source, target));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
    // Different volumes: copy, then delete.
    await cp(source, target, { recursive: true });
    await rm(source, { recursive: true, force: true });
  }
}
