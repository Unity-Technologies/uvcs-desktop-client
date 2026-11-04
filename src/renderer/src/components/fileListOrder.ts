import { compareNames } from '@shared/pathOrder';
import type { ItemOrder } from '../lib/pathTree';
import { toneRank } from './changeFilter';
import type { FileListSort } from './fileListViewStore';
import type { StatusTone } from './StatusBadge';

/** What a list of changed files knows of each file to sort and group it beyond its path. */
export interface FileListFacts<T> {
  /** The file's own status, the one its row shows (`ownTone`). */
  toneOf: (item: T) => StatusTone;
}

/**
 * How a list orders its files for a sort (`layoutPathItems`): undefined for the path order the items already come in.
 * By name compares the files' names as `comparePaths` compares a folder's (`file_2` before `file_10`); by extension,
 * files without one first; by status, in the chips' order (`toneRank`). Ties keep the path order.
 */
export function fileListOrder<T extends { path: string }>(sort: FileListSort, { toneOf }: FileListFacts<T>): ItemOrder<T> | undefined {
  switch (sort) {
    case 'path':
      return undefined;
    case 'name':
      return (a, b) => compareNames(nameOf(a.path), nameOf(b.path));
    case 'extension':
      return (a, b) => compareNames(extensionOf(a.path), extensionOf(b.path));
    case 'status':
      return (a, b) => toneRank(toneOf(a)) - toneRank(toneOf(b));
  }
}

function nameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** "png" for "a/b.PNG", "" for "Makefile" or ".gitignore": a dot that starts a name begins no extension. */
export function extensionOf(path: string): string {
  const name = nameOf(path);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/**
 * `order` as each item's place among `all`, sorted by it once: a list filtered as the user types (Changes, up to a
 * million changes) is sorted again on every key, and comparing two numbers costs far less than comparing two names
 * with the collator. Items not in `all` go last.
 */
export function rankedOrder<T>(all: readonly T[], order: ItemOrder<T>): ItemOrder<T> {
  const ranks = new Map<T, number>();
  [...all].sort(order).forEach((item, rank) => ranks.set(item, rank));
  const rankOf = (item: T): number => ranks.get(item) ?? Number.MAX_SAFE_INTEGER;
  return (a, b) => rankOf(a) - rankOf(b);
}
