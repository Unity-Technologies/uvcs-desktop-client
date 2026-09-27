import type { TreeItem } from '@shared/domain/explorer';
import type { TreeArrowRow } from '../../lib/treeArrowMove';

export interface FileTreeRow {
  item: TreeItem;
  depth: number;
  isExpanded: boolean;
  /** An expanded directory whose children are still being listed. */
  isLoading: boolean;
}

interface BuildFileTreeRowsInput {
  /** Children per directory path; the root is `''`. Missing entries have not been listed yet. */
  childrenByDirectory: ReadonlyMap<string, TreeItem[]>;
  expanded: ReadonlySet<string>;
  /** Case-insensitive name filter; directories stay visible when something inside them matches. */
  filter?: string;
  /** The workspace root as the top row (path `''`), everything else under it. */
  root?: { item: TreeItem; expanded: boolean };
}

/** Flattens the listed part of a file tree into visible rows, directories first. */
export function buildFileTreeRows({ childrenByDirectory, expanded, filter = '', root }: BuildFileTreeRowsInput): FileTreeRow[] {
  const needle = filter.trim().toLowerCase();
  const rows: FileTreeRow[] = [];
  const matches = needle ? matcherFor(needle, childrenByDirectory) : () => true;

  const visit = (directory: string, depth: number): void => {
    for (const item of sortItems(childrenByDirectory.get(directory) ?? [])) {
      const isDirectory = item.itemType === 'directory';
      const isExpanded = isDirectory && expanded.has(item.path);
      if (!matches(item)) continue;

      rows.push({ item, depth, isExpanded, isLoading: isExpanded && !childrenByDirectory.has(item.path) });
      if (isExpanded) visit(item.path, depth + 1);
    }
  };

  if (!root) {
    visit('', 0);
    return rows;
  }
  rows.push({ item: root.item, depth: 0, isExpanded: root.expanded, isLoading: root.expanded && !childrenByDirectory.has('') });
  if (root.expanded) visit('', 1);
  return rows;
}

/** The rows as ← and → see them (`treeArrowMove`). */
export function fileTreeArrowRows(rows: readonly FileTreeRow[]): TreeArrowRow[] {
  return rows.map((row) => ({ depth: row.depth, isFolder: row.item.itemType === 'directory', isExpanded: row.isExpanded }));
}

const INDENT = 16;
/** Levels indented in full; deeper ones step in by a quarter, so names deep in a tree keep room to show. */
const FULL_INDENT_LEVELS = 8;

/** How far a row at `depth` is indented, in pixels. */
export function indentOf(depth: number): number {
  const full = Math.min(depth, FULL_INDENT_LEVELS);
  return full * INDENT + (depth - full) * (INDENT / 4);
}

const byName = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true }).compare;
const sortedListings = new WeakMap<readonly TreeItem[], TreeItem[]>();

/** Directories first, then by name. Each listing is sorted once: the tree is rebuilt on every expand and filter keystroke. */
export function sortItems(items: readonly TreeItem[]): TreeItem[] {
  let sorted = sortedListings.get(items);
  if (!sorted) {
    sorted = [...items].sort((a, b) => Number(b.itemType === 'directory') - Number(a.itemType === 'directory') || byName(a.name, b.name));
    sortedListings.set(items, sorted);
  }
  return sorted;
}

/** Parent directories of a path, outermost first: `a/b/c.ts` → `['a', 'a/b']`. */
export function ancestorsOf(path: string): string[] {
  const segments = path.split('/');
  return segments.slice(0, -1).map((_, index) => segments.slice(0, index + 1).join('/'));
}

export function parentOf(path: string): string {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
}

/** Whether an item's name, or a name listed anywhere below it, contains the needle; each directory is searched once. */
function matcherFor(needle: string, childrenByDirectory: ReadonlyMap<string, TreeItem[]>): (item: TreeItem) => boolean {
  const directoryMatches = new Map<string, boolean>();
  const matches = (item: TreeItem): boolean => {
    if (item.name.toLowerCase().includes(needle)) return true;
    const children = childrenByDirectory.get(item.path);
    if (!children) return false;
    let found = directoryMatches.get(item.path);
    if (found === undefined) {
      found = children.some(matches);
      directoryMatches.set(item.path, found);
    }
    return found;
  };
  return matches;
}
