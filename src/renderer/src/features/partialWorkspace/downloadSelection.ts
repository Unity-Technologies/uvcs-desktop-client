import type { PartialRule } from '@shared/domain/workspace';
import type { CheckState } from '../../ui/Checkbox';
import { parentOf } from '../../lib/paths';

/** A file or folder of the repository, its path from the root with forward slashes and no leading slash. */
export interface DownloadItem {
  path: string;
  isDirectory: boolean;
}

/**
 * What has been read so far, folder by folder ('' is the root): `items`, each folder's children in the repository;
 * `loadedIn`, the children the workspace has loaded of each loaded folder read. A folder counts as loaded when anything
 * below it is, as `cm` counts it.
 */
export interface DownloadTree {
  items: ReadonlyMap<string, readonly DownloadItem[]>;
  loadedIn: ReadonlyMap<string, readonly string[]>;
}

/** What the user ticked or unticked: a path's choice holds for everything below it, until a deeper choice. */
export type DownloadedChoices = ReadonlyMap<string, boolean>;

const ROOT = '';

function isLoaded(path: string, tree: DownloadTree): boolean {
  if (path === ROOT) return true;
  return tree.loadedIn.get(parentOf(path))?.includes(path) ?? false;
}

/** Whether a folder's children are all known: its repository items and, when it's loaded, which of them are. */
export function isFolderRead(path: string, tree: DownloadTree): boolean {
  return tree.items.has(path) && (!isLoaded(path, tree) || tree.loadedIn.has(path));
}

function isChosen(path: string, tree: DownloadTree, choices: DownloadedChoices): boolean {
  for (let at = path; ; at = parentOf(at)) {
    const choice = choices.get(at);
    if (choice !== undefined) return choice;
    if (at === ROOT) return isLoaded(path, tree);
  }
}

/** The children whose state decides a folder's: none for a file, or a folder not read yet. */
function childrenOf(path: string, tree: DownloadTree): readonly DownloadItem[] {
  return isFolderRead(path, tree) ? (tree.items.get(path) ?? []) : [];
}

/**
 * The checkbox of an item: a read folder holding anything shows its children, mixed when some are chosen; anything
 * else shows its own choice. A loaded folder not read yet shows ticked, though only part of it may be loaded.
 */
export function checkStateOf(path: string, tree: DownloadTree, choices: DownloadedChoices): CheckState {
  const children = childrenOf(path, tree);
  if (children.length === 0) return isChosen(path, tree, choices);
  const states = children.map((child) => checkStateOf(child.path, tree, choices));
  if (states.every((state) => state === true)) return true;
  if (states.every((state) => state === false)) return false;
  return 'mixed';
}

/** The choices after the user clicks an item: an unticked or mixed one is ticked whole, a ticked one unticked whole. */
export function toggled(path: string, tree: DownloadTree, choices: DownloadedChoices): DownloadedChoices {
  const tick = checkStateOf(path, tree, choices) !== true;
  const next = new Map([...choices].filter(([at]) => !isAtOrBelow(at, path)));
  next.set(path, tick);
  return next;
}

function isAtOrBelow(at: string, path: string): boolean {
  return path === ROOT || at === path || at.startsWith(`${path}/`);
}

/**
 * The fewest rules that make the workspace hold what's chosen, empty when nothing changed: a folder downloaded or
 * removed whole is one rule. A folder partly loaded is completed item by item, since `cm partial configure` refuses
 * to download a folder that holds anything already. The root is never removed, only its items.
 */
export function downloadRules(tree: DownloadTree, choices: DownloadedChoices): PartialRule[] {
  return childrenOf(ROOT, tree).flatMap((child) => rulesFor(child.path, tree, choices));
}

function rulesFor(path: string, tree: DownloadTree, choices: DownloadedChoices): PartialRule[] {
  const loaded = isLoaded(path, tree);
  const children = childrenOf(path, tree);
  const state = checkStateOf(path, tree, choices);
  if (state === true && !loaded) return [{ path, load: true }];
  if (state === false && loaded) return [{ path, load: false }];
  return children.flatMap((child) => rulesFor(child.path, tree, choices));
}
