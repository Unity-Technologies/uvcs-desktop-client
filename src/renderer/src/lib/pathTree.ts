import { forEachIn, rangeLength, type ItemRange } from './itemRange';
import { treeArrowMove, type TreeArrowMove, type TreeArrowRow } from './treeArrowMove';

/** A folder of a tree of files: one row, even for folders that only hold the next one ("deep/very/long"). */
export interface TreeFolderRow<T> {
  type: 'folder';
  key: string;
  /** The innermost folder the row shows. */
  path: string;
  /** What the row reads: the folders it shows, from the one below its parent's row. */
  name: string;
  depth: number;
  /** The folder's own item, when it is one (a new private folder, an added, deleted or moved one). */
  item?: T;
  /** Every item in the folder, its own included, in order: a range of the list the tree was laid out from. */
  held: ItemRange<T>;
  collapsed: boolean;
}

/** An item of a tree of files, or of a flat list (depth 0). */
export interface TreeFileRow<T> {
  type: 'file';
  key: string;
  item: T;
  depth: number;
}

export type PathTreeRow<T> = TreeFolderRow<T> | TreeFileRow<T>;

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

/** The rows of a flat list: every item at depth 0. */
export function layoutPathList<T>(items: readonly T[], keyOf: (item: T) => string): TreeFileRow<T>[] {
  return items.map((item) => ({ type: 'file', key: keyOf(item), item, depth: 0 }));
}

/**
 * How a list orders its items when not by path (`fileListOrder`); undefined keeps the path order. `compare` ranks two
 * items, ties left as they come: sorting is stable, and the items come in `comparePaths` order, so ties stay in path
 * order. `arrange`, when the order has a faster way than comparing items one pair at a time (buckets, ranks worked out
 * once: `rankedOrder`), puts a whole list in that order, ties kept as they come too.
 */
export interface ItemOrder<T> {
  compare: (a: T, b: T) => number;
  arrange?: (items: readonly T[]) => T[];
}

interface PathItemsLayout<T> {
  tree: boolean;
  /** Tells the folder rows of one tree from another's on the same list (`PathTreeInput.folderScope`). */
  folderScope: string;
  order?: ItemOrder<T>;
}

/**
 * The rows of `sorted` (in `comparePaths` order) as a list or a tree, in `order`: a list sorts every item by it; a
 * tree keeps its folders in path order, first, and sorts the files of each folder by it after them
 * (`orderTreeRows`). Without an order, the path order of either.
 */
export function layoutPathItems<T extends { path: string }>(sorted: readonly T[], keyOf: (item: T) => string, { tree, folderScope, order }: PathItemsLayout<T>): PathTreeRow<T>[] {
  if (!tree) return layoutPathList(order ? arranged(sorted, order) : sorted, keyOf);
  const rows = layoutPathTree({ sorted, keyOf, folderScope });
  return order ? orderTreeRows(rows, order) : rows;
}

/** `items` in `order`: arranged at once when the order knows how, else sorted. */
export function arranged<T>(items: readonly T[], order: ItemOrder<T>): T[] {
  return order.arrange ? order.arrange(items) : [...items].sort(order.compare);
}

/**
 * A tree's rows (`layoutPathTree`) with each folder's rows in `order`: its folders first, in the order they came
 * (by path), each with what it holds, then its files sorted. A sort by name, status or extension is about the files:
 * folders keep their place, as a file browser's do.
 */
export function orderTreeRows<T>(rows: readonly PathTreeRow<T>[], order: ItemOrder<T>): PathTreeRow<T>[] {
  const ordered: PathTreeRow<T>[] = [];
  let next = 0;
  // The rows from `next` on that sit at `depth` or deeper: one folder's contents, ordered into `ordered`.
  const orderLevel = (depth: number): void => {
    const files: TreeFileRow<T>[] = [];
    while (next < rows.length && rows[next]!.depth >= depth) {
      const row = rows[next++]!;
      if (row.type === 'file') {
        files.push(row);
      } else {
        ordered.push(row);
        orderLevel(depth + 1);
      }
    }
    files.sort((a, b) => order.compare(a.item, b.item));
    for (const file of files) ordered.push(file);
  };
  orderLevel(0);
  return ordered;
}

/**
 * The rows but for what collapsed rows hold: the rows after a collapsed one at a deeper `levelOf` (its depth, unless
 * the list has rows of its own above the tree's, e.g. changelists).
 */
export function collapseTreeRows<Row extends { key: string; collapsed?: boolean }>(
  rows: Row[],
  collapsed: ReadonlySet<string>,
  levelOf: (row: Row) => number,
): Row[] {
  if (collapsed.size === 0) return rows;
  const shown: Row[] = [];
  // The level of the collapsed row whose contents are being left out.
  let hiddenBelow = Infinity;
  for (const row of rows) {
    const level = levelOf(row);
    if (level > hiddenBelow) continue;
    hiddenBelow = Infinity;
    if (row.collapsed !== undefined && collapsed.has(row.key)) {
      shown.push({ ...row, collapsed: true });
      hiddenBelow = level;
    } else {
      shown.push(row);
    }
  }
  return shown;
}

/** The rows as ← and → see them (`treeArrowMove`): folders open and close. */
export function pathTreeArrowRows<T>(rows: readonly PathTreeRow<T>[]): TreeArrowRow[] {
  return rows.map((row) => ({ depth: row.depth, isFolder: row.type === 'folder', isExpanded: row.type === 'folder' && !row.collapsed }));
}

/** What a key does on the row at `index` of a tree of files: ← and → as in any tree (`treeArrowMove`), Enter opens or closes a folder. */
export function pathTreeKeyMove<T>(rows: readonly PathTreeRow<T>[], index: number, key: string): TreeArrowMove | null {
  if (key === 'Enter') return rows[index]?.type === 'folder' ? { kind: 'toggle' } : null;
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null;
  return treeArrowMove(pathTreeArrowRows(rows), index, key);
}

/** How many items a folder's row counts: what it holds, but for the folder itself when it is an item. */
export function folderItemCount<T>(row: TreeFolderRow<T>): number {
  return rangeLength(row.held) - (row.item ? 1 : 0);
}

/** A row that stands for items: a file for its own, a folder or a group (`groupedPathTree`) for all it holds. */
type RowOfItems<T> = { type: 'file'; item: T } | { type: 'folder' | 'group'; held: ItemRange<T> };

/**
 * The items rows stand for, each once, in the rows' order: a file's own, everything in a folder or a group. What a
 * menu or the review key acts on when folders are selected along with files.
 */
export function itemsUnderRows<T>(rows: readonly RowOfItems<T>[]): T[] {
  const items = new Set<T>();
  for (const row of rows) {
    if (row.type === 'file') items.add(row.item);
    else forEachIn(row.held, (item) => items.add(item));
  }
  return [...items];
}

/**
 * The rows up to the first `limit` files, without folders whose files all come after them, and how many files are
 * left out: a list that shows only so many rows (a details pane) says how many more there are.
 */
export function firstFilesOf<T>(rows: PathTreeRow<T>[], limit: number): { rows: PathTreeRow<T>[]; unlistedFiles: number } {
  let files = 0;
  let end = rows.findIndex((row) => row.type === 'file' && ++files > limit);
  if (end === -1) return { rows, unlistedFiles: 0 };
  const unlistedFiles = rows.slice(end).filter((row) => row.type === 'file').length;
  while (end > 0 && rows[end - 1]!.type === 'folder') end--;
  return { rows: rows.slice(0, end), unlistedFiles };
}

/**
 * The key of the row showing the item keyed `itemKey`: its own row, or its folder's row when the item is a folder that
 * holds others (`layoutPathTree` gives it no row of its own). `itemKey` itself when no row shows it.
 */
export function rowKeyShowing<T>(rows: readonly { key: string; item?: T }[], itemKey: string, keyOf: (item: T) => string): string {
  for (const row of rows) if (row.key === itemKey || (row.item !== undefined && keyOf(row.item) === itemKey)) return row.key;
  return itemKey;
}

/**
 * The keys of the groups and folders holding the row keyed `key`, nearest first: opening them all shows it. `rows` are
 * laid out as if nothing were closed (`layoutPathTree`), and `levelOf` tells how deep each sits.
 */
export function rowsHolding<Row extends { key: string }>(rows: readonly Row[], key: string, levelOf: (row: Row) => number): string[] {
  const index = rows.findIndex((row) => row.key === key);
  if (index === -1) return [];
  const holding: string[] = [];
  let level = levelOf(rows[index]!);
  for (let above = index - 1; above >= 0 && level > 0; above--) {
    const aboveLevel = levelOf(rows[above]!);
    if (aboveLevel >= level) continue;
    holding.push(rows[above]!.key);
    level = aboveLevel;
  }
  return holding;
}
