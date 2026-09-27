import { pathsOf } from './workspacePaths';

/**
 * Whether `candidate` is `folder` or inside it, as the OS sees paths: separators and `..` resolved, case ignored on
 * Windows and macOS (whose disks are case-insensitive by default), accented letters however composed on macOS.
 */
export function isSameOrInside(folder: string, candidate: string, platform: NodeJS.Platform): boolean {
  const { resolve, sep } = pathsOf(platform);
  const comparable = (path: string): string => {
    const resolved = resolve(path);
    if (platform === 'win32') return resolved.toLowerCase();
    return platform === 'darwin' ? resolved.normalize('NFC').toLowerCase() : resolved;
  };
  const parent = comparable(folder);
  const child = comparable(candidate);
  return child === parent || child.startsWith(parent.endsWith(sep) ? parent : parent + sep);
}
