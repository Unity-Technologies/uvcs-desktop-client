// Whether a partial workspace can take a shelve back without a merge. `cm partial shelveset apply` has no preview and
// no way to keep a merge tool closed: on a conflict it waits for one. So a partial workspace applies a shelve only when
// what it has loaded is exactly what the shelve started from, read with one `cm ls` of the folders the shelve touches
// (`loadedItemsArgs`); otherwise the shelve stays shelved, as a standard workspace's does on a conflict.

import type { DiffEntry } from '@shared/domain/diff';
import type { LoadedItem } from '../cm/loadedItems';

/** The folders holding what the shelve touches, each once and sorted, '' for the root; never one the shelve adds. */
export function foldersShelveTouches(entries: readonly DiffEntry[]): string[] {
  const added = foldersShelveAdds(entries);
  const folders = new Set<string>();
  for (const { path, oldPath } of entries) {
    for (const touched of oldPath === undefined ? [path] : [path, oldPath]) {
      const folder = parentOf(touched);
      if (!isInside(folder, added)) folders.add(folder);
    }
  }
  return [...folders].sort();
}

/**
 * How many of the shelve's entries a merge would have to take, given what the workspace has loaded in the folders the
 * shelve touches. A change or delete needs its item loaded, unchanged, at the revision the shelve started from; an add
 * needs its path free in a folder that is there; a move needs both.
 */
export function countEntriesNeedingMerge(entries: readonly DiffEntry[], loaded: readonly LoadedItem[]): number {
  const loadedByPath = new Map(loaded.map((item) => [item.path, item]));
  const added = foldersShelveAdds(entries);
  const folderIsThere = (folder: string) => folder === '' || isInside(folder, added) || loadedByPath.get(folder)?.isDirectory === true;
  const isUnchangedAtBase = (path: string, baseRevisionId: number) => {
    const item = loadedByPath.get(path);
    return item !== undefined && !item.checkedOut && item.revisionId === baseRevisionId;
  };
  const canBePlacedAt = (path: string) => !loadedByPath.has(path) && folderIsThere(parentOf(path));

  return entries.filter((entry) => {
    switch (entry.status) {
      case 'changed':
      case 'deleted':
        return !isUnchangedAtBase(entry.path, entry.baseRevisionId);
      case 'added':
        return !canBePlacedAt(entry.path);
      case 'moved':
        return entry.oldPath === undefined || !isUnchangedAtBase(entry.oldPath, entry.baseRevisionId) || !canBePlacedAt(entry.path);
    }
  }).length;
}

function foldersShelveAdds(entries: readonly DiffEntry[]): Set<string> {
  return new Set(entries.filter((entry) => entry.status === 'added' && entry.itemType === 'directory').map((entry) => entry.path));
}

/** Whether `folder` is one of `added` or inside one: the shelve brings it, though it may not list it. */
function isInside(folder: string, added: ReadonlySet<string>): boolean {
  for (let at = folder; at !== ''; at = parentOf(at)) if (added.has(at)) return true;
  return false;
}

/** `Code/Ai/Brain.cs` → `Code/Ai`; `readme.md` → '' (the root). */
function parentOf(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash < 0 ? '' : path.slice(0, slash);
}
