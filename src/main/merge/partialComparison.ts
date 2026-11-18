// What the branch head brings a partial workspace: the items it has loaded compared with the same items on the head,
// by item id. A partial workspace on a branch isn't at a changeset (`cm status` prints cs:-1), so there are no
// changesets to list: its incoming changes are the items an update (`cm partial update`) would change.
//
// Items under an xlink belong to the xlinked repository, whose item ids are its own and collide with the workspace's
// (an xlink's root is often item 2 or 3, as the workspace's): every item is told apart by its id within its scope, the
// path of the xlink it lies under ('' for the workspace's own repository).

import type { XlinkTarget } from '@shared/domain/explorer';
import type { PartialIncomingItem } from '@shared/domain/incoming';
import { integerValue, recordFormat, type ReadRecord } from '../cm/formatRecords';
import { listedRevisionId } from '../cm/treeItems';
import { parseXlinkName } from '../cm/xlinkName';

/** The fields `cm ls -R` prints of each loaded item, read by `readLoadedTreeItem`. */
export const LOADED_TREE_FORMAT = `--format=${recordFormat(['itemid', 'revid', 'parentrevid', 'type', 'wkpath', 'changeset', 'checkout', 'name'])}`;
/** The fields `cm ls --tree` prints of each item on the branch head, read by `readHeadItem`. */
export const HEAD_TREE_FORMAT = `--format=${recordFormat(['itemid', 'revid', 'type', 'path', 'changeset', 'name'])}`;

interface ComparedItem {
  itemId: number;
  revisionId: number;
  isDirectory: boolean;
  /** Relative to the workspace's root with forward slashes, composed (NFC); '' for the root. */
  path: string;
  /** Set on an xlink: where it points. Its id, revision and changeset are the xlinked repository's, as its items'. */
  xlink?: XlinkTarget;
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
export const readLoadedTreeItem: ReadRecord<LoadedTreeItem> = ([itemid = '', revid = '', parentrevid = '', type = '', wkPath = '', changeset = '', checkout = '', name = '']) => {
  const listed = listedRevisionId(revid);
  if (listed === undefined) return undefined;
  const checkedOut = checkout !== '';
  return {
    ...comparedItem(itemid, type, wkPath.replaceAll('\\', '/'), name),
    revisionId: checkedOut ? integerValue(parentrevid) : listed,
    changeset: checkedOut ? null : integerValue(changeset),
  };
};

/** A record of `HEAD_TREE_FORMAT`: its server path (`/Code/Ship.cs`) becomes the workspace's (`Code/Ship.cs`). */
export const readHeadItem: ReadRecord<HeadItem> = ([itemid = '', revid = '', type = '', path = '', changeset = '', name = '']) => {
  const revisionId = listedRevisionId(revid);
  if (revisionId === undefined) return undefined;
  return { ...comparedItem(itemid, type, path.replace(/^\/+/, ''), name), revisionId, changeset: integerValue(changeset) };
};

/** `cm ls` lists an xlink as a directory (`dir`, never `xlink`): only its name, which names its target, tells it apart. */
function comparedItem(itemid: string, type: string, path: string, name: string): Omit<ComparedItem, 'revisionId'> {
  const xlink = parseXlinkName(name);
  return { itemId: integerValue(itemid), isDirectory: type === 'dir', path: path.normalize('NFC'), ...(xlink ? { xlink } : {}) };
}

/** The xlinks among `items`, by path. */
export function xlinksOf(items: readonly ComparedItem[]): Map<string, XlinkTarget> {
  return new Map(items.flatMap((item) => (item.xlink ? [[item.path, item.xlink] as const] : [])));
}

/** The deepest xlink at or above `path`: the one whose repository the item at `path` belongs to. */
export function enclosingXlink(path: string, xlinks: ReadonlyMap<string, XlinkTarget>): { path: string; target: XlinkTarget } | undefined {
  if (xlinks.size === 0) return undefined;
  for (let folder = path; ; folder = parentOf(folder)) {
    const target = xlinks.get(folder);
    if (target) return { path: folder, target };
    if (folder === '') return undefined;
  }
}

/** How `cm` names an xlink's repository in a spec: `pnunit@acme@cloud`, or `pnunit` when the xlink names no server. */
export function repositorySpec(target: Pick<XlinkTarget, 'repository' | 'server'>): string {
  return target.server === '' ? target.repository : `${target.repository}@${target.server}`;
}

/** An item with what tells it apart from the items of other repositories. */
interface Scoped<T extends ComparedItem> {
  item: T;
  /** The path of the xlink it lies under ('' for the workspace's repository); an xlink is in its own. */
  scope: string;
  /** Its id within its scope. */
  key: string;
  /** The xlinked repository it belongs to; undefined for the workspace's. */
  repository: string | undefined;
}

function scoped<T extends ComparedItem>(items: readonly T[]): Scoped<T>[] {
  const xlinks = xlinksOf(items);
  return items.map((item) => {
    const xlink = enclosingXlink(item.path, xlinks);
    const scope = xlink?.path ?? '';
    return { item, scope, key: scopedKey(item.itemId, scope), repository: xlink && repositorySpec(xlink.target) };
  });
}

/** `items` by their id within their scope, the key that matches a loaded item with the head's. */
export function byScopedKey<T extends ComparedItem>(items: readonly T[]): Map<string, T> {
  return new Map(scoped(items).map((each) => [each.key, each.item]));
}

function scopedKey(itemId: number, scope: string): string {
  return `${itemId}:${scope}`;
}

/** The scope of a folder's children: an xlink's own, or the folder's. */
function childScope({ item, scope }: Scoped<ComparedItem>): string {
  return item.xlink ? item.path : scope;
}

/** The loaded items and the head's, scoped, and how they meet. */
interface Comparison {
  loaded: Scoped<LoadedTreeItem>[];
  loadedKeys: Set<string>;
  headByKey: Map<string, Scoped<HeadItem>>;
}

function comparisonOf(loaded: readonly LoadedTreeItem[], head: readonly HeadItem[]): Comparison {
  const loadedItems = scoped(loaded);
  return {
    loaded: loadedItems,
    loadedKeys: new Set(loadedItems.map((each) => each.key)),
    headByKey: new Map(scoped(head).map((each) => [each.key, each])),
  };
}

/**
 * What updating to the head would do to the loaded items, sorted by path:
 * - changed: a file whose revision differs. A folder's never counts: updating leaves its loaded revision as it was.
 * - moved: an item whose path differs (renamed, or moved within what the head lists). An item that only went along
 *   with its moved folder isn't named apart: the folder stands for it, and it reads as changed only if it changed.
 * - removed: an item the head doesn't have; a removed folder stands for everything it held.
 * - added: an item new on the head in a folder the workspace loaded whole, the only kind `cm partial update` loads.
 *   `childrenWhenLoaded` holds, by the folder's loaded path, what some folders held at their loaded revision
 *   (`changedFoldersWithUnloadedItems` says which): an item the head has there and the workspace left out existed
 *   when it loaded the folder, which was then loaded in part and gets nothing added. Without that listing, the item
 *   ids tell: they grow with each item created in a repository, so a new item has a greater id than every loaded
 *   item of its repository and comes in a changeset after every loaded revision of it; one that doesn't existed
 *   before and was left out.
 * A change conflicts when the item also changed locally (`locallyChanged`, paths as the workspace has them).
 * `head` is the branch head's listing of the loaded folders and their children, a folder listed more than once kept
 * once. An item inside an xlink names the xlinked repository its revisions belong to (`repository`).
 * Every check is a lookup in a set or a map, by path or by id, so the work grows in step with the workspace.
 */
export function compareWithHead(
  loaded: readonly LoadedTreeItem[],
  head: readonly HeadItem[],
  locallyChanged: ReadonlySet<string>,
  childrenWhenLoaded: ReadonlyMap<string, readonly HeadItem[]> = new Map(),
): PartialIncomingItem[] {
  const comparison = comparisonOf(loaded, head);
  const changes = [...loadedChanges(comparison, withAncestors(locallyChanged)), ...addedItems(comparison, childrenWhenLoaded)];
  return changes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

function loadedChanges({ loaded, headByKey }: Comparison, changedLocally: ReadonlySet<string>): PartialIncomingItem[] {
  const loadedByPath = new Map(loaded.map((each) => [each.item.path, each]));
  const removedFolders = new Set(loaded.filter((each) => each.item.isDirectory && !headByKey.has(each.key)).map((each) => each.item.path));
  const changes: PartialIncomingItem[] = [];
  for (const { item, key, repository } of loaded) {
    if (isInsideAny(item.path, removedFolders)) continue;
    const inRepository = repository === undefined ? {} : { repository };
    const onHead = headByKey.get(key)?.item;
    if (!onHead) {
      changes.push({ kind: 'removed', path: item.path, isDirectory: item.isDirectory, conflict: changedLocally.has(item.path), loadedRevisionId: item.revisionId, headRevisionId: null, ...inRepository });
      continue;
    }
    const changed = !item.isDirectory && onHead.revisionId !== item.revisionId;
    const moved = onHead.path !== pathAlongWithParent(item.path, loadedByPath, headByKey);
    if (!changed && !moved) continue;
    changes.push({
      kind: changed ? 'changed' : 'moved',
      path: onHead.path,
      ...(moved ? { oldPath: item.path } : {}),
      isDirectory: item.isDirectory,
      conflict: changed && changedLocally.has(item.path),
      loadedRevisionId: item.revisionId,
      headRevisionId: onHead.revisionId,
      ...inRepository,
    });
  }
  return changes;
}

/** Where a loaded item would be on the head if it only went along with its folder: its name under the folder's head path. */
function pathAlongWithParent(path: string, loadedByPath: ReadonlyMap<string, Scoped<LoadedTreeItem>>, headByKey: ReadonlyMap<string, Scoped<HeadItem>>): string {
  if (path === '') return path;
  const parent = parentOf(path);
  const loadedParent = loadedByPath.get(parent);
  const parentOnHead = loadedParent && headByKey.get(loadedParent.key)?.item;
  if (!parentOnHead) return path;
  const name = parent === '' ? path : path.slice(parent.length + 1);
  return parentOnHead.path === '' ? name : `${parentOnHead.path}/${name}`;
}

/** A loaded folder the head changed, and the head's items in it that the workspace doesn't have. */
interface FolderWithUnloadedItems {
  folder: Scoped<LoadedTreeItem>;
  unloaded: Scoped<HeadItem>[];
}

function foldersWithUnloadedItems({ loaded, loadedKeys, headByKey }: Comparison): FolderWithUnloadedItems[] {
  const changedFolders = new Map<string, FolderWithUnloadedItems>();
  for (const each of loaded) {
    const onHead = headByKey.get(each.key)?.item;
    if (each.item.isDirectory && onHead && onHead.revisionId !== each.item.revisionId) changedFolders.set(onHead.path, { folder: each, unloaded: [] });
  }
  for (const each of headByKey.values()) {
    if (each.item.path === '' || loadedKeys.has(each.key)) continue;
    changedFolders.get(parentOf(each.item.path))?.unloaded.push(each);
  }
  return [...changedFolders.values()].filter((each) => each.unloaded.length > 0);
}

function addedItems(comparison: Comparison, childrenWhenLoaded: ReadonlyMap<string, readonly HeadItem[]>): PartialIncomingItem[] {
  const isNewByIds = newItemRule(comparison.loaded);
  const loadedChildKeys = loadedChildKeysByFolder(comparison.loaded);
  return foldersWithUnloadedItems(comparison).flatMap(({ folder, unloaded }) => {
    const listed = childrenWhenLoaded.get(folder.item.path);
    const scope = childScope(folder);
    const loadedChildren = loadedChildKeys.get(folder.item.path) ?? [];
    const added = listed ? unlistedIfWhole(unloaded, listed, scope, comparison.loadedKeys, loadedChildren) : unloaded.every(isNewByIds) ? unloaded : [];
    return added.map(({ item, repository }) => ({
      kind: 'added' as const,
      path: item.path,
      isDirectory: item.isDirectory,
      conflict: false,
      loadedRevisionId: null,
      headRevisionId: item.revisionId,
      ...(repository === undefined ? {} : { repository }),
    }));
  });
}

/**
 * `unloaded` but what `listed` (a folder's children when it was loaded) held. None if it held one the workspace left
 * out, or if it misses one the workspace loaded in it: the folder kept an older revision than what it loaded (a
 * partial workspace keeps its root at the one it was created with, changeset 0), so the listing can't tell.
 */
function unlistedIfWhole(
  unloaded: readonly Scoped<HeadItem>[],
  listed: readonly HeadItem[],
  scope: string,
  loadedKeys: ReadonlySet<string>,
  loadedChildren: readonly string[],
): Scoped<HeadItem>[] {
  const listedKeys = listed.map((item) => scopedKey(item.itemId, item.xlink ? item.path : scope));
  if (listedKeys.some((key) => !loadedKeys.has(key))) return [];
  const existed = new Set(listedKeys);
  if (loadedChildren.some((key) => !existed.has(key))) return [];
  return unloaded.filter((each) => !existed.has(each.key));
}

/** The scoped keys of the loaded items in each loaded folder, by the folder's path. */
function loadedChildKeysByFolder(loaded: readonly Scoped<LoadedTreeItem>[]): Map<string, string[]> {
  const byFolder = new Map<string, string[]>();
  for (const { item, key } of loaded) {
    if (item.path === '') continue;
    const parent = parentOf(item.path);
    const keys = byFolder.get(parent) ?? [];
    keys.push(key);
    byFolder.set(parent, keys);
  }
  return byFolder;
}

/** Whether an item may be new by its id and changeset: after every loaded item and revision of its repository. */
function newItemRule(loaded: readonly Scoped<LoadedTreeItem>[]): (item: Scoped<HeadItem>) => boolean {
  // Loops, not `Math.max(...items)`: a spread passes every item as an argument, which overflows the call stack past
  // about 125,000 items in Electron's main process.
  const greatestByScope = new Map<string, { itemId: number; changeset: number }>();
  for (const { item, scope } of loaded) {
    const greatest = greatestByScope.get(scope) ?? { itemId: -1, changeset: -1 };
    greatestByScope.set(scope, { itemId: Math.max(greatest.itemId, item.itemId), changeset: Math.max(greatest.changeset, item.changeset ?? -1) });
  }
  return ({ item, scope }) => {
    const greatest = greatestByScope.get(scope);
    return greatest === undefined || (item.itemId > greatest.itemId && item.changeset > greatest.changeset);
  };
}

/**
 * The loaded folders whose content at their loaded revision `compareWithHead` needs (its `childrenWhenLoaded`): those
 * the head changed that hold an item the workspace doesn't have, which may be new or may have been left out. A
 * checkout lists no changeset to list it at, and keeps the item-id rule.
 */
export function changedFoldersWithUnloadedItems(loaded: readonly LoadedTreeItem[], head: readonly HeadItem[]): LoadedTreeItem[] {
  return foldersWithUnloadedItems(comparisonOf(loaded, head))
    .map(({ folder }) => folder.item)
    .filter((folder) => folder.changeset !== null);
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

export function parentOf(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? '' : path.slice(0, slash);
}
