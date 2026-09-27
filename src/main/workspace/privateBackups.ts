import { cp, mkdir, readdir, readFile, rename, rm, rmdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
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
 * Returns whether everything went back (and the backup folder is gone).
 */
export async function putBack(workspacePath: string, backup: { directory: string; paths: string[] }): Promise<boolean> {
  let complete = true;
  for (const path of backup.paths) {
    if (!(await putItemBack(toAbsolutePath(backup.directory, path), toAbsolutePath(workspacePath, path)))) complete = false;
  }
  if (complete) await rm(backup.directory, { recursive: true, force: true });
  return complete;
}

/** Resolves to whether nothing of `source` is left. */
async function putItemBack(source: string, target: string): Promise<boolean> {
  const sourceStats = await stat(source).catch(() => undefined);
  if (!sourceStats) return true;
  const targetStats = await stat(target).catch(() => undefined);
  if (!targetStats) {
    await move(source, target);
    return true;
  }
  if (sourceStats.isDirectory() && targetStats.isDirectory()) {
    let complete = true;
    for (const name of await readdir(source)) if (!(await putItemBack(join(source, name), join(target, name)))) complete = false;
    if (complete) await rmdir(source);
    return complete;
  }
  if (sourceStats.isFile() && targetStats.isFile() && (await sameContent(source, target))) {
    await rm(source);
    return true;
  }
  return false;
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
