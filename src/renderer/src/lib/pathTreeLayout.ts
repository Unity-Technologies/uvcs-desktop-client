import type { ItemRange } from './itemRange';
import type { PathTreeRow, TreeFolderRow } from './pathTree';

export interface PathTreeInput<T extends { path: string }> {
  /** The items, sorted by `comparePaths` (`@shared/pathOrder`): a folder's items come right after it. */
  sorted: readonly T[];
  keyOf: (item: T) => string;
  /** Tells the folder rows of one tree from another's on the same list (e.g. a changelist's): `folder:<scope>:<path>`. */
  folderScope: string;
}

/**
 * The rows of a tree of files: each folder (folders that only hold the next one sharing a row), then what it holds.
 * A folder that is an item itself and holds others is their folder's row, not one more row beside it. Every row, as if
 * nothing was collapsed: opening or closing a folder only leaves rows out (`collapseTreeRows`).
 *
 * One pass over the items, in work that grows with the items and the folders, not with how deep they sit: in
 * `comparePaths` order a folder's items are one run of the list, so the rows open around an item are those it shares
 * with the one before, a folder row holds its run (`ItemRange`) instead of a copy, and only the folders shown are cut
 * out of a path. Each key typed in a filter lays out a tree of up to a million items again.
 */
export function layoutPathTree<T extends { path: string }>({ sorted, keyOf, folderScope }: PathTreeInput<T>): PathTreeRow<T>[] {
  const rows: PathTreeRow<T>[] = [];
  // The folder rows holding the item at hand, outermost first: a row holds every item until its run ends.
  const open: TreeFolderRow<T>[] = [];
  sorted.forEach((item, index) => {
    while (open.length > 0 && open.at(-1)!.held.end <= index) open.pop();
    // Strictly in it: the next item at the same path is the same path listed twice, not something the item holds.
    const holdsOthers = isStrictlyInFolder(sorted[index + 1]?.path, item.path);
    // The folders of the item's path below the rows open around it, the item itself last when it holds others.
    let folderEnd = nextFolderEnd(item.path, open.at(-1), holdsOthers);
    while (folderEnd !== -1) {
      const row = folderRowAt({ sorted, index, folderEnd, holdsOthers, parent: open.at(-1), folderScope });
      rows.push(row);
      open.push(row);
      folderEnd = nextFolderEnd(item.path, row, holdsOthers);
    }
    if (!holdsOthers) rows.push({ type: 'file', key: keyOf(item), item, depth: open.length });
  });
  return rows;
}

interface FolderPlace<T> {
  sorted: readonly T[];
  /** The first item in the folder: the folder itself when it is an item. */
  index: number;
  /** Where the folder's name ends in that item's path. */
  folderEnd: number;
  /** Whether that item is a folder holding the items after it. */
  holdsOthers: boolean;
  /** The row of the folder holding this one, if any. */
  parent: TreeFolderRow<T> | undefined;
  folderScope: string;
}

/**
 * The row of the folder whose name ends at `folderEnd` in the path of the item at `index`, with the folders below it
 * that hold only the next one, down to one that is an item itself (it keeps its status).
 */
function folderRowAt<T extends { path: string }>({ sorted, index, folderEnd, holdsOthers, parent, folderScope }: FolderPlace<T>): TreeFolderRow<T> {
  const item = sorted[index]!;
  const folder = item.path.slice(0, folderEnd);
  const held: ItemRange<T> = { list: sorted, start: index, end: runEnd(sorted, index, folder, parent?.held.end ?? sorted.length) };
  // Sorted by `comparePaths`, the first item and the last tell whether everything in the folder is in the next one.
  const lastPath = sorted[held.end - 1]!.path;
  let shownEnd = folderEnd;
  while (shownEnd < item.path.length) {
    const nextEnd = nameEnd(item.path, shownEnd + 1, holdsOthers);
    if (nextEnd === -1 || !isInFolder(lastPath, item.path.slice(0, nextEnd))) break;
    shownEnd = nextEnd;
  }
  const path = shownEnd === folderEnd ? folder : item.path.slice(0, shownEnd);
  return {
    type: 'folder',
    key: `folder:${folderScope}:${path}`,
    path,
    name: parent ? path.slice(parent.path.length + 1) : path,
    depth: parent ? parent.depth + 1 : 0,
    item: shownEnd === item.path.length ? item : undefined,
    held,
    collapsed: false,
  };
}

/** Where the next folder of `path` below the `parent` row ends; -1 when none is left. */
function nextFolderEnd<T>(path: string, parent: TreeFolderRow<T> | undefined, holdsOthers: boolean): number {
  return nameEnd(path, parent ? parent.path.length + 1 : 0, holdsOthers);
}

/** Where the name starting at `from` in `path` ends, if it is a folder's: at a "/", or at the path's end when it holds others. */
function nameEnd(path: string, from: number, holdsOthers: boolean): number {
  const slash = path.indexOf('/', from);
  if (slash !== -1) return slash;
  return holdsOthers && from <= path.length ? path.length : -1;
}

/**
 * Whether `path` is `folder` or in it, telling without making a string. The character after the folder's name goes
 * first: it tells a file apart from the next one at once, without comparing their folders.
 */
function isInFolder(path: string | undefined, folder: string): boolean {
  if (path === undefined) return false;
  if (path.length !== folder.length && path.charCodeAt(folder.length) !== SLASH) return false;
  return path.startsWith(folder);
}

/** Whether `path` is in `folder`, below it: not the folder itself. */
function isStrictlyInFolder(path: string | undefined, folder: string): boolean {
  return path !== undefined && path.length > folder.length && isInFolder(path, folder);
}

const SLASH = '/'.charCodeAt(0);

/**
 * Where the items in `folder` end, the first of them at `first`, before `limit` (where the folder holding it ends): in
 * `comparePaths` order they are one run, so its end is found by halves.
 */
function runEnd<T extends { path: string }>(sorted: readonly T[], first: number, folder: string, limit: number): number {
  let low = first + 1;
  let high = limit;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (isInFolder(sorted[middle]!.path, folder)) low = middle + 1;
    else high = middle;
  }
  return low;
}
