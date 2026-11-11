import type { PartialIncomingItem } from '@shared/domain/incoming';
import type { CheckState } from '../../ui/Checkbox';
import { partialItemKey } from './partialIncomingItems';

/**
 * Which of a partial workspace's incoming items Update brings. Items start checked, so the view keeps the keys
 * (`partialItemKey`) the user unchecked: an item the next check finds is checked without anyone adding it.
 */
export type UncheckedItems = ReadonlySet<string>;

/** What `cm partial update` is given for the checked items, and every item it then brings. */
export interface PartialUpdateSelection {
  /** Workspace paths, relative and with '/'; 'all' when the update brings every item, so it names none. */
  paths: readonly string[] | 'all';
  brought: readonly PartialIncomingItem[];
}

export function partialItemChecked(item: PartialIncomingItem, unchecked: UncheckedItems): boolean {
  return !unchecked.has(partialItemKey(item));
}

export function partialGroupCheckState(items: readonly PartialIncomingItem[], unchecked: UncheckedItems): CheckState {
  const checkedCount = items.filter((item) => partialItemChecked(item, unchecked)).length;
  if (checkedCount === 0) return false;
  return checkedCount === items.length ? true : 'mixed';
}

export function withItemsChecked(unchecked: UncheckedItems, items: readonly PartialIncomingItem[], checked: boolean): UncheckedItems {
  const next = new Set(unchecked);
  for (const item of items) {
    if (checked) next.delete(partialItemKey(item));
    else next.add(partialItemKey(item));
  }
  return next;
}

/**
 * `cm partial update <paths>` updates each path and everything under it, by where it is in the workspace. So an item's
 * head path is turned back into its workspace path (a folder the head moved is still at its old path), an added item
 * comes with its parent folder, and a moved one needs both the item and the folder it moves into. Bringing one item
 * may bring others under the same folder: `brought` says which, and the update counts those.
 */
export function partialUpdateSelection(items: readonly PartialIncomingItem[], unchecked: UncheckedItems): PartialUpdateSelection {
  const checked = items.filter((item) => partialItemChecked(item, unchecked));
  if (checked.length === 0) return { paths: [], brought: [] };
  if (checked.length === items.length) return { paths: 'all', brought: items };

  const inWorkspace = workspacePathOf(items);
  const needed = checked.flatMap((item) => pathsNeeded(item, inWorkspace));
  if (needed.includes('')) return { paths: 'all', brought: items };

  const paths = outermostPaths(needed);
  const brought = items.filter((item) => pathsNeeded(item, inWorkspace).every((path) => paths.some((covering) => isWithin(path, covering))));
  return brought.length === items.length ? { paths: 'all', brought: items } : { paths, brought };
}

function pathsNeeded(item: PartialIncomingItem, inWorkspace: (headPath: string) => string): string[] {
  switch (item.kind) {
    case 'removed':
      return [item.path];
    case 'changed':
      return [inWorkspace(item.path)];
    case 'added':
      return [inWorkspace(parentOf(item.path))];
    case 'moved':
      return [item.oldPath ?? inWorkspace(item.path), inWorkspace(parentOf(item.path))];
  }
}

/** Turns a head path into where the item is in the workspace: under the innermost folder the head moved, its old path. */
function workspacePathOf(items: readonly PartialIncomingItem[]): (headPath: string) => string {
  const movedFolders = items
    .filter((item) => item.kind === 'moved' && item.isDirectory && item.oldPath !== undefined)
    .sort((a, b) => b.path.length - a.path.length);
  return (headPath) => {
    const folder = movedFolders.find((each) => isWithin(headPath, each.path));
    return folder?.oldPath === undefined ? headPath : folder.oldPath + headPath.slice(folder.path.length);
  };
}

function outermostPaths(paths: readonly string[]): string[] {
  const sorted = [...new Set(paths)].sort();
  return sorted.filter((path) => !sorted.some((other) => other !== path && isWithin(path, other)));
}

function isWithin(path: string, folder: string): boolean {
  return folder === '' || path === folder || path.startsWith(`${folder}/`);
}

function parentOf(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash < 0 ? '' : path.slice(0, slash);
}
