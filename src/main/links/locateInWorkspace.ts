import { realpath } from 'node:fs/promises';
import type { WorkspaceLocation } from '@shared/domain/workspace';
import { pathsOf } from '../files/workspacePaths';

interface LocateDependencies {
  /** The root of the workspace holding a path (`findWorkspaceRoot`); null outside any. */
  findRoot: (path: string) => Promise<string | null>;
  /** The path with every link followed; throws for one that doesn't exist. */
  resolve?: (path: string) => Promise<string>;
  platform?: NodeJS.Platform;
}

/**
 * The workspace holding a file or folder a link names (`uvcs:///…`, docs/features/deep-links.md), and where in it.
 * Both paths are compared with their links followed: `cm` names the root as it is on disk (`/private/tmp/wk` on macOS,
 * where `/tmp` is a link), and a link may name it through a link (`/tmp/wk`, a junction on Windows, a linked home on
 * Linux). An item that doesn't exist (deleted, still to come) is found by its folder.
 */
export async function locateInWorkspace(path: string, { findRoot, resolve = realpath, platform = process.platform }: LocateDependencies): Promise<WorkspaceLocation | null> {
  const root = await findRoot(path);
  if (!root) return null;
  const paths = pathsOf(platform);
  const resolved = async (target: string): Promise<string> => {
    try {
      return await resolve(target);
    } catch {
      const parent = paths.dirname(target);
      return parent === target ? target : paths.join(await resolved(parent), paths.basename(target));
    }
  };
  const relative = paths.relative(await resolved(root), await resolved(path));
  if (relative.startsWith('..') || paths.isAbsolute(relative)) return null;
  return { root, itemPath: relative.split(paths.sep).join('/') };
}
