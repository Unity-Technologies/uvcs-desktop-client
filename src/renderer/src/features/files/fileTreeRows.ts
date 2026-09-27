import type { TreeItem } from '@shared/domain/explorer';
import { matchesAllWords } from '../../lib/matchesAllWords';
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
  /** Words every shown name must hold, in any case; directories stay visible when something inside them matches. */
  filter?: string;
  /** The workspace root as the top row (path `''`), everything else under it. */
  root?: { item: TreeItem; expanded: boolean };
}

/** Flattens the listed part of a file tree into visible rows, directories first. */
export function buildFileTreeRows({ childrenByDirectory, expanded, filter = '', root }: BuildFileTreeRowsInput): FileTreeRow[] {
  const rows: FileTreeRow[] = [];
  const matches = filter.trim() ? matcherFor(filter, childrenByDirectory) : () => true;

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

/**
 * As the official client lists them: folders (and xlinks) first, then files, each with the controlled ones before the
 * private ones, then by name. Each listing is sorted once: the tree is rebuilt on every expand and filter keystroke.
 */
export function sortItems(items: readonly TreeItem[]): TreeItem[] {
  let sorted = sortedListings.get(items);
  if (!sorted) {
    sorted = [...items].sort((a, b) => Number(isFolder(b)) - Number(isFolder(a)) || Number(a.isPrivate) - Number(b.isPrivate) || byName(a.name, b.name));
    sortedListings.set(items, sorted);
  }
  return sorted;
}

function isFolder(item: TreeItem): boolean {
  return item.itemType === 'directory' || item.itemType === 'xlink';
}

/** Parent directories of a path, outermost first: `a/b/c.ts` → `['a', 'a/b']`. */
export function ancestorsOf(path: string): string[] {
  const segments = path.split('/');
  return segments.slice(0, -1).map((_, index) => segments.slice(0, index + 1).join('/'));
}

export function parentOf(path: string): string {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
}

/** Whether an item's name, or a name listed anywhere below it, holds every word of the filter; each directory is searched once. */
function matcherFor(filter: string, childrenByDirectory: ReadonlyMap<string, TreeItem[]>): (item: TreeItem) => boolean {
  const directoryMatches = new Map<string, boolean>();
  const matches = (item: TreeItem): boolean => {
    if (matchesAllWords(item.name, filter)) return true;
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
