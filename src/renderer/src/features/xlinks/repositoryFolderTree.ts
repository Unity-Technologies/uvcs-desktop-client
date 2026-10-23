import { parentOf } from '../../lib/paths';

/** What is known of a folder's folders: listed, being read, or not readable. Absent: never asked. */
export type FolderListing = readonly string[] | 'loading' | 'failed';

/** A row of the folder picker's tree. Paths are `/`-rooted repository paths; the root is `/`. */
export interface FolderRow {
  path: string;
  name: string;
  /** How far in it sits: the root is 0. */
  level: number;
  expanded: boolean;
  /** Whether it may hold folders: false only once it is read and holds none. */
  expandable: boolean;
  /** What shows in place of its folders while expanded: read, being read, or failed. */
  contents: 'shown' | 'loading' | 'failed';
}

/** The repository path's parent: `/Assets/Lib` → `/Assets`, `/Assets` → `/`. */
export function parentFolder(path: string): string {
  return path === '/' ? '/' : `/${parentOf(path.slice(1))}`;
}

/** The folder the picker opens on, selected: what the field holds, however it was typed. */
export function openingFolder(typed: string): string {
  return '/';
}

/** The folders open as the picker opens: the root, and every folder above `chosen` so it shows. */
export function initiallyExpanded(chosen: string): Set<string> {
  const expanded = new Set(['/']);
  for (let folder = parentFolder(chosen); folder !== '/'; folder = parentFolder(folder)) expanded.add(folder);
  return expanded;
}

/** The rows shown: the root (named `rootName`), and the folders of every expanded folder, depth first. */
export function folderRows(rootName: string, listings: ReadonlyMap<string, FolderListing>, expanded: ReadonlySet<string>): FolderRow[] {
  const rows: FolderRow[] = [];
  const visit = (path: string, name: string, level: number): void => {
    const listing = listings.get(path);
    const isExpanded = expanded.has(path);
    rows.push({
      path,
      name,
      level,
      expanded: isExpanded,
      expandable: !(Array.isArray(listing) && listing.length === 0),
      contents: listing === 'failed' ? 'failed' : Array.isArray(listing) ? 'shown' : 'loading',
    });
    if (isExpanded && Array.isArray(listing)) for (const child of listing as readonly string[]) visit(child, child.slice(child.lastIndexOf('/') + 1), level + 1);
  };
  visit('/', rootName, 0);
  return rows;
}

/** What a key does in the tree: the row selected next, a folder to open or close, or the folder chosen. */
export interface FolderKeyOutcome {
  select?: string;
  toggle?: string;
  choose?: string;
}

/**
 * A desktop tree's keys: ↑ ↓ move, → opens a closed folder or goes into an open one, ← closes an open folder or goes
 * to its parent, Enter chooses the selected folder. Undefined for any other key.
 */
export function folderKey(rows: readonly FolderRow[], selected: string, key: string): FolderKeyOutcome | undefined {
  const index = Math.max(0, rows.findIndex((row) => row.path === selected));
  const row = rows[index];
  if (!row) return undefined;
  switch (key) {
    case 'ArrowDown':
      return { select: rows[Math.min(rows.length - 1, index + 1)]!.path };
    case 'ArrowUp':
      return { select: rows[Math.max(0, index - 1)]!.path };
    case 'ArrowRight':
      if (!row.expandable) return {};
      if (!row.expanded) return { toggle: row.path };
      return rows[index + 1]?.level === row.level + 1 ? { select: rows[index + 1]!.path } : {};
    case 'ArrowLeft':
      if (row.expanded && row.level > 0) return { toggle: row.path };
      return row.level > 0 ? { select: parentFolder(row.path) } : {};
    case 'Enter':
      return { choose: row.path };
    default:
      return undefined;
  }
}

/** The expanded folders with `path` opened or closed. The root stays open: the picker shows nothing without it. */
export function toggled(expanded: ReadonlySet<string>, path: string): Set<string> {
  const next = new Set(expanded);
  if (next.has(path) && path !== '/') next.delete(path);
  else next.add(path);
  return next;
}
