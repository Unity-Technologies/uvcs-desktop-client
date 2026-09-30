import type { TreeItem } from '@shared/domain/explorer';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { parentOf } from './fileTreeRows';

/**
 * A workspace folder's listing (`''` is the root): one query shared by the Files tree, Go to file's actions, Paste and
 * the name checks of New and Rename, so a folder read by one is read for all.
 */
export function directoryListingQuery(workspacePath: string, directory: string) {
  return {
    queryKey: directoryListingKey(workspacePath, directory),
    queryFn: () => api.explorer.listDirectory(workspacePath, directory),
  };
}

export function directoryListingKey(workspacePath: string, directory: string) {
  return queryKeys.inWorkspace(workspacePath, 'explorer', 'directory', directory);
}

/** A folder's listing, if it was read. */
export function listedItems(workspacePath: string, directory: string): TreeItem[] | undefined {
  return queryClient.getQueryData<TreeItem[]>(directoryListingKey(workspacePath, directory));
}

/** A folder's listing, read now unless it was already. */
export function readDirectoryListing(workspacePath: string, directory: string): Promise<TreeItem[]> {
  return queryClient.ensureQueryData(directoryListingQuery(workspacePath, directory));
}

/**
 * The item at a path as its folder's listing has it (with its version control details), reading the listing if needed.
 * Paths are the workspace's, relative: an item at the root is in `''`.
 */
export async function readListedItem(workspacePath: string, path: string): Promise<TreeItem | undefined> {
  const listing = await readDirectoryListing(workspacePath, parentOf(path));
  return listing.find((item) => item.path === path);
}
