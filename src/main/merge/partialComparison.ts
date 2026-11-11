// What the branch head brings a partial workspace: the items it has loaded compared with the same items on the head,
// by item id. A partial workspace isn't at a changeset (`cm status` prints cs:-1), so there are no changesets to list:
// its incoming changes are the items an update (`cm partial update`) would change.

import type { PartialIncomingItem } from '@shared/domain/incoming';
import { integerValue, recordFormat, type ReadRecord } from '../cm/formatRecords';
import { listedRevisionId } from '../cm/treeItems';

/** The fields `cm ls -R` prints of each loaded item, read by `readLoadedTreeItem`. */
export const LOADED_TREE_FORMAT = `--format=${recordFormat(['itemid', 'revid', 'parentrevid', 'type', 'wkpath', 'changeset', 'checkout'])}`;
/** The fields `cm ls --tree` prints of each item on the branch head, read by `readHeadItem`. */
export const HEAD_TREE_FORMAT = `--format=${recordFormat(['itemid', 'revid', 'type', 'path', 'changeset'])}`;

interface ComparedItem {
  itemId: number;
  revisionId: number;
  isDirectory: boolean;
  /** Relative to the workspace's root with forward slashes, composed (NFC); '' for the root. */
  path: string;
  /** Set on an xlink, whose items belong to another repository and are left out of the comparison. */
  xlink?: true;
}

/** An item as the workspace has it loaded. */
export interface LoadedTreeItem extends ComparedItem {
  /** The changeset of the revision loaded; null for a checkout, which `cm` lists without one. */
  changeset: number | null;
}

/** An item as the branch head has it. */
export interface HeadItem extends ComparedItem {
  /** The changeset of its revision on the head. */
  changeset: number;
}

/**
 * A record of `LOADED_TREE_FORMAT`. A checkout lists no revision (-1) and its loaded one as `{parentrevid}`, which is
 * what the head is compared with. A private item, which has no revision, is left out.
 */
export const readLoadedTreeItem: ReadRecord<LoadedTreeItem> = ([itemid = '', revid = '', parentrevid = '', type = '', wkPath = '', changeset = '', checkout = '']) => {
  const listed = listedRevisionId(revid);
  if (listed === undefined) return undefined;
  const checkedOut = checkout !== '';
  return {
    ...comparedItem(itemid, type, wkPath.replaceAll('\\', '/')),
    revisionId: checkedOut ? integerValue(parentrevid) : listed,
    changeset: checkedOut ? null : integerValue(changeset),
  };
};

/** A record of `HEAD_TREE_FORMAT`: its server path (`/Code/Ship.cs`) becomes the workspace's (`Code/Ship.cs`). */
export const readHeadItem: ReadRecord<HeadItem> = ([itemid = '', revid = '', type = '', path = '', changeset = '']) => {
  const revisionId = listedRevisionId(revid);
  if (revisionId === undefined) return undefined;
  return { ...comparedItem(itemid, type, path.replace(/^\/+/, '')), revisionId, changeset: integerValue(changeset) };
};

function comparedItem(itemid: string, type: string, path: string): Omit<ComparedItem, 'revisionId'> {
  return { itemId: integerValue(itemid), isDirectory: type === 'dir', path: path.normalize('NFC'), ...(type === 'xlink' ? { xlink: true as const } : {}) };
}

/**
 * What updating to the head would do to the loaded items, sorted by path:
 * - changed: a file whose revision differs. A folder's never counts: updating leaves its loaded revision as it was.
 * - moved: an item whose path differs (renamed, or moved within what the head lists).
 * - removed: an item the head doesn't have; a removed folder stands for everything it held.
 * - added: an item new on the head in a loaded folder, the only kind `cm partial update` loads. One the workspace
 *   left out exists since before what it loaded: item ids grow with each item created, so a new one has a greater id
 *   than every loaded item and comes in a changeset after every loaded revision.
 * A change conflicts when the item also changed locally (`locallyChanged`, paths as the workspace has them).
 * `head` is the branch head's listing of the loaded folders and their children, a folder listed more than once kept
 * once. Items of xlinks belong to other repositories, with ids of their own, and are left out.
 */
export function compareWithHead(loaded: readonly LoadedTreeItem[], head: readonly HeadItem[], locallyChanged: ReadonlySet<string>): PartialIncomingItem[] {
  const loadedItems = withoutXlinks(loaded);
  const headById = new Map(withoutXlinks(head).map((item) => [item.itemId, item]));
  const loadedIds = new Set(loadedItems.map((item) => item.itemId));
  const changedLocally = (path: string): boolean => locallyChanged.has(path) || [...locallyChanged].some((changed) => changed.startsWith(`${path}/`));

  const changes = [...loadedChanges(loadedItems, headById, changedLocally), ...addedItems(loadedItems, headById, loadedIds)];
  return changes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

function loadedChanges(loaded: readonly LoadedTreeItem[], headById: ReadonlyMap<number, HeadItem>, changedLocally: (path: string) => boolean): PartialIncomingItem[] {
  const changes: PartialIncomingItem[] = [];
  const removedFolders: string[] = [];
  for (const item of [...loaded].sort((a, b) => a.path.length - b.path.length)) {
    if (removedFolders.some((folder) => item.path.startsWith(`${folder}/`))) continue;
    const onHead = headById.get(item.itemId);
    if (!onHead) {
      if (item.isDirectory) removedFolders.push(item.path);
      changes.push({ kind: 'removed', path: item.path, isDirectory: item.isDirectory, conflict: changedLocally(item.path), loadedRevisionId: item.revisionId, headRevisionId: null });
      continue;
    }
    const changed = !item.isDirectory && onHead.revisionId !== item.revisionId;
    const moved = onHead.path !== item.path;
    if (!changed && !moved) continue;
    changes.push({
      kind: changed ? 'changed' : 'moved',
      path: onHead.path,
      ...(moved ? { oldPath: item.path } : {}),
      isDirectory: item.isDirectory,
      conflict: changed && changedLocally(item.path),
      loadedRevisionId: item.revisionId,
      headRevisionId: onHead.revisionId,
    });
  }
  return changes;
}

function addedItems(loaded: readonly LoadedTreeItem[], headById: ReadonlyMap<number, HeadItem>, loadedIds: ReadonlySet<number>): PartialIncomingItem[] {
  const newestChangeset = Math.max(-1, ...loaded.map((item) => item.changeset ?? -1));
  const greatestItemId = Math.max(-1, ...loaded.map((item) => item.itemId));
  const loadedFoldersOnHead = new Set(loaded.filter((item) => item.isDirectory).flatMap((item) => headById.get(item.itemId)?.path ?? []));
  return [...headById.values()]
    .filter((item) => !loadedIds.has(item.itemId) && item.itemId > greatestItemId && item.changeset > newestChangeset)
    .filter((item) => item.path !== '' && loadedFoldersOnHead.has(parentOf(item.path)))
    .map((item) => ({ kind: 'added', path: item.path, isDirectory: item.isDirectory, conflict: false, loadedRevisionId: null, headRevisionId: item.revisionId }));
}

function withoutXlinks<T extends ComparedItem>(items: readonly T[]): T[] {
  const xlinks = items.filter((item) => item.xlink).map((item) => item.path);
  return items.filter((item) => !item.xlink && !xlinks.some((xlink) => item.path.startsWith(`${xlink}/`)));
}

function parentOf(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? '' : path.slice(0, slash);
}
