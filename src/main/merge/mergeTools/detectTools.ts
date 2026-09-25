import { posix, win32 } from 'node:path';
import type { KnownTool, Whereabouts } from './knownTools';

/** The little of the file system detection needs, so tests can stand in for it. */
export interface ToolFileSystem {
  exists(path: string): boolean;
  /** The names in a folder; none if it can't be read. */
  list(folder: string): string[];
}

export interface DetectedTool {
  tool: KnownTool;
  executable: string;
}

/** The known tools installed here, each at its first location found, then on the PATH. */
export function detectKnownTools(tools: KnownTool[], where: Whereabouts, fs: ToolFileSystem): DetectedTool[] {
  return tools.flatMap((tool) => {
    if (tool.requires && !tool.requires(where).some((path) => fs.exists(path))) return [];
    const executable = findFirst(tool.locations(where), where, fs) ?? findOnPath(tool.commands[where.platform] ?? [], where, fs);
    return executable ? [{ tool, executable }] : [];
  });
}

/** A program named in client.conf: a path as it is, a bare name on the PATH. */
export function locateProgram(program: string, where: Whereabouts, fs: ToolFileSystem): string | undefined {
  if (/[\\/]/.test(program)) return fs.exists(program) ? program : undefined;
  const names = where.platform === 'win32' && !/\.\w+$/.test(program) ? [`${program}.exe`, `${program}.cmd`] : [program];
  return findOnPath(names, where, fs);
}

function findFirst(candidates: string[], where: Whereabouts, fs: ToolFileSystem): string | undefined {
  for (const candidate of candidates) {
    const found = candidate.includes('*') ? expandWildcard(candidate, where, fs) : fs.exists(candidate) && candidate;
    if (found) return found;
  }
  return undefined;
}

/** `C:\Program Files\JetBrains\JetBrains Rider *\bin\rider64.exe`: the newest-named match of the one `*` folder. */
function expandWildcard(candidate: string, where: Whereabouts, fs: ToolFileSystem): string | undefined {
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

function findOnPath(names: string[], where: Whereabouts, fs: ToolFileSystem): string | undefined {
  const path = pathFor(where);
  const folders = (where.env.PATH ?? where.env.Path ?? '').split(path.delimiter).filter(Boolean);
  for (const name of names) {
    const found = folders.map((folder) => path.join(folder, name)).find((candidate) => fs.exists(candidate));
    if (found) return found;
  }
  return undefined;
}

function pathFor(where: Whereabouts): typeof posix {
  return where.platform === 'win32' ? win32 : posix;
}
