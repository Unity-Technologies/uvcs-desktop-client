import type { RepositoryTreePoint, TreeItem } from '@shared/domain/explorer';
import type { ItemType } from '@shared/domain/pendingChanges';
import type { PartialRule, WorkspaceInfo, WorkspaceSelector } from '@shared/domain/workspace';
import type { CheckState } from '../../ui/Checkbox';
import { navigationTarget } from '../../lib/listNavigation';
import { parentOf } from '../../lib/paths';
import { ancestorsOf } from '../files/fileTreeRows';
import { iconTypeOf } from '../files/xlinkItem';
import { checkStateOf, isFolderRead, isLoaded, type DownloadItem, type DownloadTree, type DownloadedChoices } from './downloadSelection';

const ROOT = '';

/**
 * The tree the dialog decides on, from the repository's listings and what the workspace has loaded, folder by folder.
 * An xlink, which `cm ls` may list as a folder with a target, is downloaded whole, like a file: its own repository's
 * folders aren't chosen here.
 */
export function downloadTreeOf(
  listings: ReadonlyMap<string, readonly TreeItem[]>,
  loadedIn: ReadonlyMap<string, readonly string[]>,
): DownloadTree {
  const items = new Map<string, DownloadItem[]>();
  for (const [folder, children] of listings) {
    items.set(
      folder,
      children.map((child) => {
        const iconType = iconTypeOf(child);
        return { path: child.path, isDirectory: iconType === 'directory', iconType };
      }),
    );
  }
  return { items, loadedIn };
}

/**
 * The folders whose loaded items to read: the root and each open folder the workspace holds anything of. `cm ls`
 * can't list a folder that isn't loaded, and whether one is shows only once its parent is read.
 */
export function foldersToReadLoaded(tree: DownloadTree, expanded: ReadonlySet<string>): string[] {
  return [...new Set([ROOT, ...expanded])].filter((folder) => isLoaded(folder, tree));
}

/** A row of the Choose what to download tree. Paths have forward slashes and no leading slash. */
export interface DownloadRow {
  path: string;
  name: string;
  /** How far in it sits: the root's items are 0. */
  level: number;
  isDirectory: boolean;
  /** What its icon draws, as Files draws it. */
  iconType: ItemType;
  expanded: boolean;
  /** Whether it may hold items: a folder, unless it is read and holds none. */
  expandable: boolean;
  check: CheckState;
  /** Shown beside an open folder still being read, or one that couldn't be. */
  note: 'loading' | 'failed' | undefined;
  /** Why it couldn't be read, once it failed. */
  failure: string | undefined;
}

/**
 * The rows shown: the root's items, and the items of every open folder once it is read, depth first. A folder's
 * items show only once both the repository and the workspace sides are read, so their checks are right.
 */
export function downloadRows(
  tree: DownloadTree,
  choices: DownloadedChoices,
  expanded: ReadonlySet<string>,
  failures: ReadonlyMap<string, string>,
): DownloadRow[] {
  const rows: DownloadRow[] = [];
  const visit = (item: DownloadItem, level: number): void => {
    const read = item.isDirectory && isFolderRead(item.path, tree);
    const children = read ? (tree.items.get(item.path) ?? []) : [];
    const expandable = item.isDirectory && !(read && children.length === 0);
    const isExpanded = expandable && expanded.has(item.path);
    const failure = isExpanded ? failures.get(item.path) : undefined;
    rows.push({
      path: item.path,
      name: item.path.slice(item.path.lastIndexOf('/') + 1),
      level,
      isDirectory: item.isDirectory,
      iconType: item.iconType,
      expanded: isExpanded,
      expandable,
      check: checkStateOf(item.path, tree, choices),
      note: failure !== undefined ? 'failed' : isExpanded && !read ? 'loading' : undefined,
      failure,
    });
    if (isExpanded) for (const child of children) visit(child, level + 1);
  };
  for (const item of tree.items.get(ROOT) ?? []) visit(item, 0);
  return rows;
}

/** What a key does in the tree: the row selected next, a folder to open or close, or an item ticked or unticked. */
export interface DownloadKeyOutcome {
  select?: string;
  expand?: string;
  check?: string;
}

/**
 * A desktop tree's keys: ↑ ↓ move, Page Up and Page Down a screenful (`navigationTarget`), Home and End to the first
 * and last row, → opens a closed folder or goes into an open one, ← closes an open folder or goes to its parent, Space
 * ticks or unticks the selected item. Undefined for any other key, which the dialog lets through.
 */
export function downloadKey(rows: readonly DownloadRow[], selected: string, key: string): DownloadKeyOutcome | undefined {
  const index = Math.max(0, rows.findIndex((row) => row.path === selected));
  const row = rows[index];
  if (!row) return undefined;
  const moved = navigationTarget(key, index, rows.length);
  if (moved !== null) return { select: rows[moved]!.path };
  switch (key) {
    case 'Home':
      return { select: rows[0]!.path };
    case 'End':
      return { select: rows[rows.length - 1]!.path };
    case 'ArrowRight':
      if (!row.expandable) return {};
      if (!row.expanded) return { expand: row.path };
      return rows[index + 1]?.level === row.level + 1 ? { select: rows[index + 1]!.path } : {};
    case 'ArrowLeft':
      if (row.expanded) return { expand: row.path };
      return row.level > 0 ? { select: parentOf(row.path) } : {};
    case ' ':
      return { check: row.path };
    default:
      return undefined;
  }
}

/** What Apply will do, in a few words: how many items are downloaded and removed. */
export function rulesSummary(rules: readonly PartialRule[]): string {
  const downloads = rules.filter((rule) => rule.load).length;
  const removals = rules.length - downloads;
  if (downloads === 0 && removals === 0) return 'No changes';
  if (downloads === 0) return `${itemCount(removals)} to remove`;
  const downloading = `${itemCount(downloads)} to download`;
  return removals === 0 ? downloading : `${downloading}, ${removals} to remove`;
}

function itemCount(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

/** What the dialog's body shows: the root still being read, the root unreadable, a repository of nothing, or the tree. */
export type DownloadRootStatus = 'loading' | 'failed' | 'empty' | 'ready';

/** The body's state from the root: its items show only once both its sides are read, so their checks are right. */
export function rootStatus(tree: DownloadTree, failures: ReadonlyMap<string, string>): DownloadRootStatus {
  if (failures.has(ROOT)) return 'failed';
  if (!isFolderRead(ROOT, tree)) return 'loading';
  return (tree.items.get(ROOT) ?? []).length === 0 ? 'empty' : 'ready';
}

/**
 * The repository tree to choose from: the changeset the workspace loaded, or, on a partial workspace on a branch, which
 * loaded no one changeset, the branch's head, which its updates follow. Null on a shelve, whose tree is no
 * changeset of the repository to list.
 */
export function downloadTreePoint({ selector, loadedChangeset }: Pick<WorkspaceInfo, 'selector' | 'loadedChangeset'>): RepositoryTreePoint | null {
  if (loadedChangeset != null) return { kind: 'changeset', changeset: loadedChangeset };
  if (selector.kind === 'branch') return { kind: 'branch', branch: selector.name };
  return null;
}

/**
 * The tree once a search's pick is shown: every folder above it opened, those already open kept, and the pick
 * selected. A folder picked stays closed, as Files shows one it goes to.
 */
export function revealedDownload(path: string, expanded: ReadonlySet<string>): { expanded: Set<string>; selected: string } {
  return { expanded: new Set([...expanded, ...ancestorsOf(path)]), selected: path };
}

/**
 * The changeset a search of the tree looks in: the one the tree shows or, on a branch, its head once it is read
 * (`branchHead`). Null while there's none to search, so the search waits.
 */
export function downloadSearchChangeset(point: RepositoryTreePoint | null, branchHead: number | undefined): number | null {
  if (point?.kind === 'changeset') return point.changeset;
  if (point?.kind === 'branch') return branchHead ?? null;
  return null;
}

/** What the search's notes say it looks in: the branch or label the workspace is on, or its changeset. */
export function downloadSearchName(selector: WorkspaceSelector): string {
  return selector.kind === 'changeset' ? `changeset ${selector.name}` : selector.name;
}
