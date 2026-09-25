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
}

/** Flattens the listed part of a file tree into visible rows, directories first. */
export function buildFileTreeRows({ childrenByDirectory, expanded, filter = '' }: BuildFileTreeRowsInput): FileTreeRow[] {
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

  visit('', 0);
  return rows;
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
