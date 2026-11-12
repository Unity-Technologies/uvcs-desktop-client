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
 * - moved: an item whose path differs (renamed, or moved within what the head lists). An item that only went along
 *   with its moved folder isn't named apart: the folder stands for it, and it reads as changed only if it changed.
 * - removed: an item the head doesn't have; a removed folder stands for everything it held.
 * - added: an item new on the head in a folder the workspace loaded whole, the only kind `cm partial update` loads.
 *   One the workspace left out exists since before what it loaded: item ids grow with each item created, so a new one
 *   has a greater id than every loaded item and comes in a changeset after every loaded revision. That rule misses an
 *   older item created after the workspace loaded something else, so `existedWhenLoaded` names the items the folder
 *   held at its loaded revision (`foldersWithNewItems` says which folders to list for it). A loaded folder that holds
 *   an item that existed and was left out was loaded in part, and gets nothing added: the new items in it are left out
 *   like the rest.
 * A change conflicts when the item also changed locally (`locallyChanged`, paths as the workspace has them).
 * `head` is the branch head's listing of the loaded folders and their children, a folder listed more than once kept
 * once. Items of xlinks belong to other repositories, with ids of their own, and are left out.
 * Every check is a lookup in a set or a map, by path or by id, so the work grows in step with the workspace.
 */
export function compareWithHead(
  loaded: readonly LoadedTreeItem[],
  head: readonly HeadItem[],
  locallyChanged: ReadonlySet<string>,
  existedWhenLoaded: ReadonlySet<number> = new Set(),
): PartialIncomingItem[] {
  const loadedItems = withoutXlinks(loaded);
  const headById = new Map(withoutXlinks(head).map((item) => [item.itemId, item]));
  const changes = [...loadedChanges(loadedItems, headById, withAncestors(locallyChanged)), ...addedItems(unloadedChildrenOf(loadedItems, headById, existedWhenLoaded))];
  return changes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

function loadedChanges(loaded: readonly LoadedTreeItem[], headById: ReadonlyMap<number, HeadItem>, changedLocally: ReadonlySet<string>): PartialIncomingItem[] {
  const loadedByPath = new Map(loaded.map((item) => [item.path, item]));
  const removedFolders = new Set(loaded.filter((item) => item.isDirectory && !headById.has(item.itemId)).map((item) => item.path));
  const changes: PartialIncomingItem[] = [];
  for (const item of loaded) {
    if (isInsideAny(item.path, removedFolders)) continue;
    const onHead = headById.get(item.itemId);
    if (!onHead) {
      changes.push({ kind: 'removed', path: item.path, isDirectory: item.isDirectory, conflict: changedLocally.has(item.path), loadedRevisionId: item.revisionId, headRevisionId: null });
      continue;
    }
    const changed = !item.isDirectory && onHead.revisionId !== item.revisionId;
    const moved = onHead.path !== pathAlongWithParent(item.path, loadedByPath, headById);
    if (!changed && !moved) continue;
    changes.push({
      kind: changed ? 'changed' : 'moved',
      path: onHead.path,
      ...(moved ? { oldPath: item.path } : {}),
      isDirectory: item.isDirectory,
      conflict: changed && changedLocally.has(item.path),
      loadedRevisionId: item.revisionId,
      headRevisionId: onHead.revisionId,
    });
  }
  return changes;
}

/** Where a loaded item would be on the head if it only went along with its folder: its name under the folder's head path. */
function pathAlongWithParent(path: string, loadedByPath: ReadonlyMap<string, LoadedTreeItem>, headById: ReadonlyMap<number, HeadItem>): string {
  if (path === '') return path;
  const parent = parentOf(path);
  const parentOnHead = loadedByPath.get(parent) && headById.get(loadedByPath.get(parent)!.itemId);
  if (!parentOnHead) return path;
  const name = parent === '' ? path : path.slice(parent.length + 1);
  return parentOnHead.path === '' ? name : `${parentOnHead.path}/${name}`;
}

/** The head's items in the loaded folders that the workspace doesn't have, and which of them may be new on the head. */
interface UnloadedChildren {
  items: HeadItem[];
  isNew: (item: HeadItem) => boolean;
  /** Head paths of the folders loaded in part: they hold an item that existed when loaded and was left out. */
  partlyLoaded: Set<string>;
}

function unloadedChildrenOf(loaded: readonly LoadedTreeItem[], headById: ReadonlyMap<number, HeadItem>, existedWhenLoaded: ReadonlySet<number>): UnloadedChildren {
  // Loops, not `Math.max(...items)`: a spread passes every item as an argument, which overflows the call stack past
  // about 125,000 items in Electron's main process.
  let newestChangeset = -1;
  let greatestItemId = -1;
  for (const item of loaded) {
    newestChangeset = Math.max(newestChangeset, item.changeset ?? -1);
    greatestItemId = Math.max(greatestItemId, item.itemId);
  }
  const isNew = (item: HeadItem) => item.itemId > greatestItemId && item.changeset > newestChangeset && !existedWhenLoaded.has(item.itemId);
  const loadedIds = new Set(loaded.map((item) => item.itemId));
  const loadedFoldersOnHead = new Set(loaded.filter((item) => item.isDirectory).flatMap((item) => headById.get(item.itemId)?.path ?? []));
  const items = [...headById.values()].filter((item) => !loadedIds.has(item.itemId) && item.path !== '' && loadedFoldersOnHead.has(parentOf(item.path)));
  return { items, isNew, partlyLoaded: new Set(items.filter((item) => !isNew(item)).map((item) => parentOf(item.path))) };
}

function addedItems({ items, isNew, partlyLoaded }: UnloadedChildren): PartialIncomingItem[] {
  return items
    .filter((item) => isNew(item) && !partlyLoaded.has(parentOf(item.path)))
    .map((item) => ({ kind: 'added', path: item.path, isDirectory: item.isDirectory, conflict: false, loadedRevisionId: null, headRevisionId: item.revisionId }));
}

/**
 * The loaded folders whose content at their loaded revision `compareWithHead` needs (its `existedWhenLoaded`): those
 * that look whole but hold an item that looks new, which may have existed all along. A checkout lists no changeset to
 * list it at, and keeps the item-id rule. Few folders, and none once a folder is known to be loaded in part.
 */
export function foldersWithNewItems(loaded: readonly LoadedTreeItem[], head: readonly HeadItem[]): LoadedTreeItem[] {
  const loadedItems = withoutXlinks(loaded);
  const headById = new Map(withoutXlinks(head).map((item) => [item.itemId, item]));
  const { items, isNew, partlyLoaded } = unloadedChildrenOf(loadedItems, headById, new Set());
  const parents = new Set(items.filter((item) => isNew(item) && !partlyLoaded.has(parentOf(item.path))).map((item) => parentOf(item.path)));
  return loadedItems.filter((item) => {
    const onHead = headById.get(item.itemId);
    return item.isDirectory && item.changeset !== null && onHead !== undefined && parents.has(onHead.path);
  });
}

function withoutXlinks<T extends ComparedItem>(items: readonly T[]): T[] {
  const xlinks = new Set(items.filter((item) => item.xlink).map((item) => item.path));
  return items.filter((item) => !item.xlink && !isInsideAny(item.path, xlinks));
}

/** Whether `path` is inside one of `folders` (paths relative to the root, '' the root itself). */
export function isInsideAny(path: string, folders: ReadonlySet<string>): boolean {
  for (let folder = path; folder !== ''; ) {
    folder = parentOf(folder);
    if (folders.has(folder)) return true;
  }
  return false;
}

/** `paths` and every folder holding one of them: a folder counts as changed locally when something in it did. */
function withAncestors(paths: ReadonlySet<string>): Set<string> {
  const all = new Set<string>();
  for (const path of paths) {
    for (let folder = path; !all.has(folder); folder = parentOf(folder)) {
      all.add(folder);
      if (folder === '') break;
    }
  }
  return all;
}

function parentOf(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? '' : path.slice(0, slash);
}
