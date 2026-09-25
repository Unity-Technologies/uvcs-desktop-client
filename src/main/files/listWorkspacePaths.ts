import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const SKIPPED_DIRECTORIES = new Set(['.plastic', '.git']);

export interface WorkspacePath {
  /** Relative to the workspace root, with forward slashes. */
  path: string;
  isDirectory: boolean;
}

/**
 * Every file and directory in the workspace, private ones included, read straight from disk.
 * Much faster than `cm ls -R` (about half a second instead of 16 for 350k items). Symbolic links are listed, not followed.
 */
export async function listWorkspacePaths(workspacePath: string): Promise<WorkspacePath[]> {
  const paths: WorkspacePath[] = [];

  async function walk(directory: string, prefix: string): Promise<void> {
    let children: Dirent[];
    try {
      children = await readdir(directory, { withFileTypes: true });
    } catch {
      return; // Unreadable, or deleted while walking.
    }

    await Promise.all(
      children.map((child) => {
        const isDirectory = child.isDirectory();
        if (isDirectory && SKIPPED_DIRECTORIES.has(child.name)) return;

        const path = prefix + child.name;
        paths.push({ path, isDirectory });
        return isDirectory ? walk(join(directory, child.name), `${path}/`) : undefined;
      }),
    );
  }

  await walk(workspacePath, '');
  return paths;
}
