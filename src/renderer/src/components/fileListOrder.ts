import { comparePaths, compareNames } from '@shared/pathOrder';
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
 * By name compares the files' names as `comparePaths` compares a folder's (`file_2` before `file_10`), each name read
 * once; by extension, files without one first; by status, in the chips' order (`toneRank`). Ties keep the path order.
 * Status and extension arrange a whole list in buckets, in one pass, without comparing items (`bucketOrder`).
 */
export function fileListOrder<T extends { path: string }>(sort: FileListSort, { toneOf }: FileListFacts<T>): ItemOrder<T> | undefined {
  switch (sort) {
    case 'path':
      return undefined;
    case 'name':
      return { compare: compareByKey((item: T) => nameOf(item.path), compareNames) };
    case 'extension':
      return bucketOrder((item: T) => extensionOf(item.path), compareNames);
    case 'status':
      return bucketOrder((item: T) => toneRank(toneOf(item)), (a, b) => a - b);
  }
}

/** Two items compared by a key worked out once per item: a sort compares each item about log n times. */
function compareByKey<T, K>(keyOf: (item: T) => K, compareKeys: (a: K, b: K) => number): (a: T, b: T) => number {
  const keys = new Map<T, K>();
  const key = (item: T): K => {
    if (keys.has(item)) return keys.get(item)!;
    const found = keyOf(item);
    keys.set(item, found);
    return found;
  };
  return (a, b) => compareKeys(key(a), key(b));
}

/**
 * An order by a key few items differ in (a status, an extension): a list is arranged by putting each item in its key's
 * bucket, in the order it comes, then the buckets in their keys' order. One pass over the items, and a sort of the
 * few distinct keys only.
 */
function bucketOrder<T, K>(keyOf: (item: T) => K, compareKeys: (a: K, b: K) => number): ItemOrder<T> {
  const compare = compareByKey(keyOf, compareKeys);
  return {
    compare,
    arrange: (items) => {
      const buckets = new Map<K, T[]>();
      for (const item of items) {
        const key = keyOf(item);
        const bucket = buckets.get(key);
        if (bucket) bucket.push(item);
        else buckets.set(key, [item]);
      }
      const arranged: T[] = [];
      for (const key of [...buckets.keys()].sort(compareKeys)) for (const item of buckets.get(key)!) arranged.push(item);
      return arranged;
    },
  };
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

/** `order` with every item of a list ranked once (`rankedOrder`): what the list was put in, and each item's place in it. */
export interface RankedOrder<T> extends ItemOrder<T> {
  /** Every item of the list, in the order. */
  ordered: readonly T[];
}

/**
 * `order` as each item's place among `all`, put in order once: a list filtered as the user types (Changes, up to a
 * million changes) is arranged again on every key, and picking the items out of the ranks costs one pass, where
 * sorting them compares names again. Items not in `all` go last. `previous`, the ranking of the list a read before,
 * keeps the order of the items still in it: only the others are sorted, then merged in (as `sortedFromPrevious`
 * does for the path order), unless fewer than half are still there.
 */
export function rankedOrder<T extends { path: string }>(all: readonly T[], order: ItemOrder<T>, previous?: RankedOrder<T>): RankedOrder<T> {
  const ordered = order.arrange ? order.arrange(all) : orderedFromPrevious(all, order.compare, previous?.ordered);
  const ranks = new Map<T, number>();
  ordered.forEach((item, rank) => ranks.set(item, rank));
  const rankOf = (item: T): number => ranks.get(item) ?? Number.MAX_SAFE_INTEGER;
  return {
    ordered,
    compare: (a, b) => rankOf(a) - rankOf(b),
    arrange: (items) => pickInRankOrder(items, ordered.length, rankOf),
  };
}

/**
 * `items` by their ranks: placed in a slot per rank and read back, in one pass over the ranks, when that costs less
 * than sorting them (a filter leaving most of the list); sorted by rank when they are few (one status group's).
 */
function pickInRankOrder<T>(items: readonly T[], rankCount: number, rankOf: (item: T) => number): T[] {
  if (items.length * Math.log2(items.length + 1) < rankCount) return [...items].sort((a, b) => rankOf(a) - rankOf(b));
  const slots: (T | undefined)[] = new Array(rankCount);
  const unranked: T[] = [];
  for (const item of items) {
    const rank = rankOf(item);
    if (rank < rankCount) slots[rank] = item;
    else unranked.push(item);
  }
  const picked: T[] = [];
  for (const item of slots) if (item !== undefined) picked.push(item);
  for (const item of unranked) picked.push(item);
  return picked;
}

/** `all` in `compare` order, starting from `previous` (an earlier `all` in that order) when most of it is still there. */
function orderedFromPrevious<T extends { path: string }>(all: readonly T[], compare: (a: T, b: T) => number, previous: readonly T[] | undefined): T[] {
  if (!previous) return [...all].sort(compare);
  const current = new Set(all);
  const kept = previous.filter((item) => current.has(item));
  if (kept.length === all.length) return kept;
  if (kept.length < all.length / 2) return [...all].sort(compare);
  const keptSet = new Set(kept);
  const added = all.filter((item) => !keptSet.has(item)).sort(compare);
  // Ties between a kept item and an added one go by path, as a sort of items in path order would have left them.
  const before = (a: T, b: T): boolean => (compare(a, b) || comparePaths(a.path, b.path)) <= 0;
  const merged: T[] = [];
  let [i, j] = [0, 0];
  while (i < kept.length && j < added.length) merged.push(before(kept[i]!, added[j]!) ? kept[i++]! : added[j++]!);
  while (i < kept.length) merged.push(kept[i++]!);
  while (j < added.length) merged.push(added[j++]!);
  return merged;
}
