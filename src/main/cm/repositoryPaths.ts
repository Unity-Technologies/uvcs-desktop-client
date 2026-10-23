import type { FoundPath } from '@shared/domain/explorer';
import { recordFormat, type ReadRecord } from './formatRecords';

const FIELDS = ['type', 'path'];

/**
 * Every item of the repository's tree at `treeSpec` (`cs:12@game@local`), its type and path only: one `cm ls -R`, the
 * whole tree, xlinked repositories included, as Browse repository loads it. `cm` sends it all once its tree is built,
 * nothing before, and it is read record by record as it arrives (`readListedPath`), never held whole.
 */
export function repositoryPathsArgs(treeSpec: string): string[] {
  return ['ls', '/', '-R', `--tree=${treeSpec}`, `--format=${recordFormat(FIELDS)}`];
}

/**
 * One record of `repositoryPathsArgs`: the item, its path without the leading slash; none for the root itself. On
 * Windows `cm` joins the path below the root with backslashes (`/Assets\Player.cs`): read as the tree names it.
 */
export const readListedPath: ReadRecord<FoundPath> = ([type, path]) => {
  const relative = path?.replaceAll('\\', '/').replace(/^\//, '') ?? '';
  // An xlink is a folder of the tree: the listing walks into it.
  return relative ? { path: relative, isDirectory: type === 'dir' || type === 'xlink' } : undefined;
};

/**
 * One item as a line of a tree's file on disk (`RepositoryPathSearch`): `d` or `f`, then its path. An item whose path
 * holds a line break (which Windows can't even write) is left out (`''`): every line is one item.
 */
export function listedPathLine({ path, isDirectory }: FoundPath): string {
  if (path.includes('\n') || path.includes('\r')) return '';
  return `${isDirectory ? 'd' : 'f'}${path}\n`;
}

/** A line written by `listedPathLine`, its line break already gone; none for an empty or unknown one. */
export function readListedPathLine(line: string): FoundPath | undefined {
  const kind = line[0];
  if ((kind !== 'd' && kind !== 'f') || line.length < 2) return undefined;
  return { path: line.slice(1), isDirectory: kind === 'd' };
}
