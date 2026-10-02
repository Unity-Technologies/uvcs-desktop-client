import { pathFolders } from '../pathFolders';
import type { AppFileSystem } from './appFileSystem';
import { pathFor, type Whereabouts } from './whereabouts';

/** The first of `candidates` that exists; a `*` in one stands for any name in one folder (a version number). */
export function findFirst(candidates: string[], where: Whereabouts, fs: AppFileSystem): string | undefined {
  for (const candidate of candidates) {
    const found = candidate.includes('*') ? expandWildcard(candidate, where, fs) : fs.exists(candidate) ? candidate : undefined;
    if (found) return found;
  }
  return undefined;
}

/** `C:\Program Files\JetBrains\JetBrains Rider *\bin\rider64.exe`: the newest-named match of the one `*` folder. */
function expandWildcard(candidate: string, where: Whereabouts, fs: AppFileSystem): string | undefined {
  const path = pathFor(where);
  const parts = candidate.split(path.sep);
  const index = parts.findIndex((part) => part.includes('*'));
  const parent = parts.slice(0, index).join(path.sep);
  const [prefix, suffix] = parts[index]!.split('*') as [string, string];
  const matches = fs
    .list(parent)
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  return matches.map((name) => [parent, name, ...parts.slice(index + 1)].join(path.sep)).find((match) => fs.exists(match));
}

/** The first of `names` found in a folder of the PATH, in the PATH's order. */
export function findOnPath(names: string[], where: Whereabouts, fs: AppFileSystem): string | undefined {
  const path = pathFor(where);
  const folders = pathFolders(where.env, where.platform);
  for (const name of names) {
    const found = folders.map((folder) => path.join(folder, name)).find((candidate) => fs.exists(candidate));
    if (found) return found;
  }
  return undefined;
}
