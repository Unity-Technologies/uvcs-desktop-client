import { access, cp, mkdir, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { toAbsolutePath } from '../files/workspacePaths';

/** Moves workspace items (workspace-relative paths) into `directory`, keeping their relative paths. */
export async function moveAside(workspacePath: string, paths: string[], directory: string): Promise<void> {
  for (const path of paths) await move(toAbsolutePath(workspacePath, path), toAbsolutePath(directory, path));
}

/**
 * Moves the items back into the workspace. An item the workspace has again in the meantime is not overwritten:
 * it stays in the backup. Returns whether everything went back (and the backup folder is gone).
 */
export async function putBack(workspacePath: string, backup: { directory: string; paths: string[] }): Promise<boolean> {
  let complete = true;
  for (const path of backup.paths) {
    const source = toAbsolutePath(backup.directory, path);
    const target = toAbsolutePath(workspacePath, path);
    if (!(await exists(source))) continue;
    if (await exists(target)) complete = false;
    else await move(source, target);
  }
  if (complete) await rm(backup.directory, { recursive: true, force: true });
  return complete;
}

async function move(source: string, target: string): Promise<void> {
  await mkdir(dirname(target), { recursive: true });
  try {
    await rename(source, target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
    // Different volumes: copy, then delete.
    await cp(source, target, { recursive: true });
    await rm(source, { recursive: true, force: true });
  }
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}
