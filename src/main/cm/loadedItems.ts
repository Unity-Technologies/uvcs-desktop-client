// What a workspace has loaded in some folders: `cm ls <folders> --format=…`, a read of the workspace's metadata that
// tells, for each item, the revision it was loaded from and whether it is checked out. Choosing what a partial
// workspace downloads reads it to show what is loaded (`WorkspacesApi.loadedIn`), and a partial workspace reads it
// before taking a shelve back (`shelveAppliesWithoutMerge`).

import { recordFormat, type ReadRecord } from './formatRecords';
import { onLinksThemselves } from './symlinkArgs';
import { listedRevisionId } from './treeItems';

const FIELDS = ['wkpath', 'type', 'revid', 'checkout'];

/** An item as the workspace has it loaded. */
export interface LoadedItem {
  /** Relative to the workspace's root with forward slashes, composed (NFC); '' for the root. */
  path: string;
  isDirectory: boolean;
  /** The revision loaded; -1 for a checkout, which `cm ls` lists without one. */
  revisionId: number;
  checkedOut: boolean;
}

/**
 * `cm ls` of workspace folders, by their absolute paths: each folder itself, then its children, links as themselves.
 * A path the workspace hasn't loaded fails the command (`Item … not found.`), though the others are still listed.
 */
export function loadedItemsArgs(absoluteFolders: readonly string[]): string[] {
  return onLinksThemselves('ls', ...absoluteFolders, `--format=${recordFormat(FIELDS)}`);
}

/**
 * A listed item. `cm` prints paths with the OS's separator and, on macOS, names decomposed: both are made the app's.
 * A private item, which has no revision, is left out.
 */
export const readLoadedItem: ReadRecord<LoadedItem> = ([wkPath = '', type = '', revid = '', checkout = '']) => {
  const revisionId = listedRevisionId(revid);
  if (revisionId === undefined) return undefined;
  return { path: wkPath.replaceAll('\\', '/').normalize('NFC'), isDirectory: type === 'dir', revisionId, checkedOut: checkout !== '' };
};
