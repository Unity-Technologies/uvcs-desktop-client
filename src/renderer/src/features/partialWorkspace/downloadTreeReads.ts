import type { PartialRule } from '@shared/domain/workspace';
import type { TreeItem } from '@shared/domain/explorer';

const ROOT = '';
export const READ_FAILURE = 'Couldn’t read this folder';

/** One folder's read, as the dialog's queries report it: its data once read, and whether reading it failed. */
export interface FolderRead<T> {
  folder: string;
  data: T | undefined;
  failed: boolean;
}

/** What the choose-downloads dialog has read so far: the repository's folders, the workspace's, and those that failed. */
export interface DownloadTreeReads {
  listings: Map<string, readonly TreeItem[]>;
  loadedIn: Map<string, readonly string[]>;
  failures: Map<string, string>;
}

/** The folders read so far, by folder; those still reading are left out. */
export function dataByFolder<T>(reads: readonly FolderRead<T>[]): Map<string, T> {
  const byFolder = new Map<string, T>();
  for (const read of reads) if (read.data !== undefined) byFolder.set(read.folder, read.data);
  return byFolder;
}

/**
 * Joins the repository's listings and the workspace's loaded items into what the tree is built from. A folder fails
 * when either read of it does; the root fails when the workspace has no tree to list (`treeless`: on a shelve).
 */
export function downloadTreeReads({
  treeless,
  listings,
  loaded,
}: {
  treeless: boolean;
  listings: readonly FolderRead<readonly TreeItem[]>[];
  loaded: readonly FolderRead<readonly string[]>[];
}): DownloadTreeReads {
  const failures = new Map<string, string>();
  if (treeless) failures.set(ROOT, READ_FAILURE);
  for (const read of [...listings, ...loaded]) if (read.failed) failures.set(read.folder, READ_FAILURE);
  return { listings: dataByFolder(listings), loadedIn: dataByFolder(loaded), failures };
}

/** Apply runs only when the choices change something, and not while it's already running. */
export function canApply(rules: readonly PartialRule[], applying: boolean): boolean {
  return rules.length > 0 && !applying;
}
