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
  /** Every item in the folder, its own included, in order. */
  items: T[];
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
  sorted: T[];
  keyOf: (item: T) => string;
  /** Tells the folder rows of one tree from another's on the same list (e.g. a changelist's): `folder:<scope>:<path>`. */
  folderScope: string;
}

/**
 * The rows of a tree of files: each folder (folders that only hold the next one sharing a row), then what it holds.
 * A folder that is an item itself and holds others is their folder's row, not one more row beside it. Every row, as if
 * nothing was collapsed: opening or closing a folder only leaves rows out (`collapseTreeRows`). In n·log n work: tens
 * of thousands of items lay out on every change of the list.
 */
export function layoutPathTree<T extends { path: string }>({ sorted, keyOf, folderScope }: PathTreeInput<T>): PathTreeRow<T>[] {
  const rows: PathTreeRow<T>[] = [];
  const byPath = new Map(sorted.map((item) => [item.path, item]));
  // Each item's path and the folders above it ("a", "a/b", "a/b/c.txt"), built once: every level is looked up by them.
  const prefixes = sorted.map((item) => pathPrefixes(item.path));
  const folders = new Set<string>();
  for (const paths of prefixes) for (let level = 0; level < paths.length - 1; level++) folders.add(paths[level]!);
  // The row showing each folder: folders that only hold the next one share its row.
  const folderRows = new Map<string, TreeFolderRow<T>>();
  // The level of the innermost folder each row shows.
  const lastLevels = new Map<TreeFolderRow<T>, number>();

  sorted.forEach((item, index) => {
    const paths = prefixes[index]!;
    const pathAt = (level: number): string => paths[level]!;
    const isFolder = folders.has(item.path);
    const folderCount = isFolder ? paths.length : paths.length - 1;
    let depth = 0;
    for (let level = 0; level < folderCount; level++) {
      let row = folderRows.get(pathAt(level));
      if (!row) {
        const inside = itemsInFolder(sorted, index, pathAt(level));
        let last = level;
        while (last + 1 < folderCount && !byPath.has(pathAt(last)) && holdsOnly(inside, pathAt(last + 1))) last++;
        const path = pathAt(last);
        row = {
          type: 'folder',
          key: `folder:${folderScope}:${path}`,
          path,
          name: level === 0 ? path : path.slice(pathAt(level - 1).length + 1),
          depth,
          item: byPath.get(path),
          items: inside,
          collapsed: false,
        };
        rows.push(row);
        lastLevels.set(row, last);
        for (let chained = level; chained <= last; chained++) folderRows.set(pathAt(chained), row);
      }
      level = lastLevels.get(row)!;
      depth = row.depth + 1;
    }

    if (!isFolder) rows.push({ type: 'file', key: keyOf(item), item, depth });
  });
  return rows;
}

/** The rows of a flat list: every item at depth 0. */
export function layoutPathList<T>(items: T[], keyOf: (item: T) => string): TreeFileRow<T>[] {
  return items.map((item) => ({ type: 'file', key: keyOf(item), item, depth: 0 }));
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

/** A row that stands for items: a file for its own, a folder or a group (`groupedPathTree`) for all it holds. */
type RowOfItems<T> = { type: 'file'; item: T } | { type: 'folder' | 'group'; items: T[] };

/**
 * The items rows stand for, each once, in the rows' order: a file's own, everything in a folder or a group. What a
 * menu or the review key acts on when folders are selected along with files.
 */
export function itemsUnderRows<T>(rows: readonly RowOfItems<T>[]): T[] {
  const items = new Set<T>();
  for (const row of rows) {
    if (row.type === 'file') items.add(row.item);
    else for (const item of row.items) items.add(item);
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

/** Whether all a folder holds is `child`, one of its folders, or in it. */
function holdsOnly<T extends { path: string }>(inside: T[], child: string): boolean {
  // Sorted by `comparePaths`, the first and the last item tell for all of them.
  return [inside[0]!, inside.at(-1)!].every((item) => item.path === child || item.path.startsWith(`${child}/`));
}

/** The items in a folder, first met at `first`: sorted by `comparePaths`, they are the ones right after it. */
function itemsInFolder<T extends { path: string }>(sorted: T[], first: number, folder: string): T[] {
  const inside = `${folder}/`;
  let end = first;
  while (end < sorted.length && (sorted[end]!.path === folder || sorted[end]!.path.startsWith(inside))) end++;
  return sorted.slice(first, end);
}

/** "a/b/c.txt" is in "a" and "a/b": ["a", "a/b", "a/b/c.txt"]. */
function pathPrefixes(path: string): string[] {
  const prefixes: string[] = [];
  for (let end = path.indexOf('/'); end !== -1; end = path.indexOf('/', end + 1)) prefixes.push(path.slice(0, end));
  prefixes.push(path);
  return prefixes;
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
