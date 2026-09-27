import { pathsOf } from './workspacePaths';

/**
 * Whether `candidate` is `folder` or inside it, as the OS sees paths: separators and `..` resolved, case ignored on
 * Windows and macOS (whose disks are case-insensitive by default), accented letters however composed on macOS.
 */
export function isSameOrInside(folder: string, candidate: string, platform: NodeJS.Platform): boolean {
  const parent = comparablePath(folder, platform);
  const child = comparablePath(candidate, platform);
  return child === parent || child.startsWith(asFolder(parent, platform));
}

/**
 * The paths none of the others holds, in their given order: acting on a folder acts on what it holds, which is gone
 * by the time its turn comes (trashing a folder and the files picked inside it). One sorted pass, for thousands.
 */
export function outermostPaths(paths: readonly string[], platform: NodeJS.Platform): string[] {
  // A folder's key is a prefix of everything inside it, which sorts right after it.
  const keyed = paths.map((path, index) => ({ index, key: asFolder(comparablePath(path, platform), platform) }));
  const sorted = [...keyed].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.index - b.index));
  const kept = new Set<number>();
  let holder: string | undefined;
  for (const { index, key } of sorted) {
    if (holder !== undefined && key.startsWith(holder)) continue;
    kept.add(index);
    holder = key;
  }
  return paths.filter((_, index) => kept.has(index));
}

function comparablePath(path: string, platform: NodeJS.Platform): string {
  const resolved = pathsOf(platform).resolve(path);
  if (platform === 'win32') return resolved.toLowerCase();
  return platform === 'darwin' ? resolved.normalize('NFC').toLowerCase() : resolved;
}

function asFolder(path: string, platform: NodeJS.Platform): string {
  const { sep } = pathsOf(platform);
  return path.endsWith(sep) ? path : path + sep;
}
