import type { TreeItem } from '@shared/domain/explorer';

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

  const visit = (directory: string, depth: number): void => {
    for (const item of sortItems(childrenByDirectory.get(directory) ?? [])) {
      const isDirectory = item.itemType === 'directory';
      const isExpanded = isDirectory && expanded.has(item.path);
      if (needle && !matchesBelow(item, needle, childrenByDirectory)) continue;

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

/** What ← or → does on the row at `index`, as in any tree: open or close a folder, or step into it or out to its parent. */
export type TreeArrowMove = { kind: 'toggle' } | { kind: 'moveBy'; step: number };

export function treeArrowMove(rows: readonly FileTreeRow[], index: number, key: 'ArrowLeft' | 'ArrowRight'): TreeArrowMove | null {
  const row = rows[index];
  if (!row) return null;
  const isDirectory = row.item.itemType === 'directory';
  if (key === 'ArrowRight') {
    if (!isDirectory) return null;
    if (!row.isExpanded) return { kind: 'toggle' };
    return (rows[index + 1]?.depth ?? -1) > row.depth ? { kind: 'moveBy', step: 1 } : null;
  }
  if (isDirectory && row.isExpanded) return { kind: 'toggle' };
  for (let parent = index - 1; parent >= 0; parent--) {
    if (rows[parent]!.depth < row.depth) return { kind: 'moveBy', step: parent - index };
  }
  return null;
}

const INDENT = 16;
/** Levels indented in full; deeper ones step in by a quarter, so names deep in a tree keep room to show. */
const FULL_INDENT_LEVELS = 8;

/** How far a row at `depth` is indented, in pixels. */
export function indentOf(depth: number): number {
  const full = Math.min(depth, FULL_INDENT_LEVELS);
  return full * INDENT + (depth - full) * (INDENT / 4);
}

export function sortItems(items: TreeItem[]): TreeItem[] {
  return [...items].sort((a, b) => {
    const directoryFirst = Number(b.itemType === 'directory') - Number(a.itemType === 'directory');
    return directoryFirst || a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
  });
}

/** Parent directories of a path, outermost first: `a/b/c.ts` → `['a', 'a/b']`. */
export function ancestorsOf(path: string): string[] {
  const segments = path.split('/');
  return segments.slice(0, -1).map((_, index) => segments.slice(0, index + 1).join('/'));
}

export function parentOf(path: string): string {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
}

function matchesBelow(item: TreeItem, needle: string, childrenByDirectory: ReadonlyMap<string, TreeItem[]>): boolean {
  if (item.name.toLowerCase().includes(needle)) return true;
  return (childrenByDirectory.get(item.path) ?? []).some((child) => matchesBelow(child, needle, childrenByDirectory));
}
