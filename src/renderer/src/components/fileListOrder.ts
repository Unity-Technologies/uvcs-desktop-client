import { comparePaths, compareNames } from '@shared/pathOrder';
import { arranged, type ItemOrder } from '../lib/pathTree';
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
 * files without one first; by status, in the chips' order (`toneRank`). Ties keep the path order. Each arranges a whole
 * list in buckets, one per name, extension or status, comparing only those (`bucketOrder`): a project's files share
 * names (`index.ts`, `README.md`, a `.prefab` in each scene), and a million changes compared one by one by name took 4 s.
 */
export function fileListOrder<T extends { path: string }>(sort: FileListSort, { toneOf }: FileListFacts<T>): ItemOrder<T> | undefined {
  switch (sort) {
    case 'path':
      return undefined;
    case 'name':
      return bucketOrder((item: T) => nameOf(item.path), compareNames);
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
 * An order by a key items share (a status, an extension, a name): a list is arranged by putting each item in its key's
 * bucket, in the order it comes, then the buckets in their keys' order. One pass over the items, and a sort of the
 * distinct keys only.
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
  /** Where an item is in `ordered`; undefined for one not in the list. */
  rankOf: (item: T) => number | undefined;
}

/**
 * `order` as each item's place among `all`, put in order once: a list filtered as the user types (Changes, up to a
 * million changes) is arranged again on every key, and picking the items out of the ranks costs a look-up each, where
 * sorting them compares names again. Items not in `all` go last. `previous`, the ranking of the list a read before,
 * keeps the order of the items still in it, and only the others are put in order and found their places among them
 * (`orderedFromPrevious`), unless fewer than half are still there.
 */
export function rankedOrder<T extends { path: string }>(all: readonly T[], order: ItemOrder<T>, previous?: RankedOrder<T>): RankedOrder<T> {
  const ordered = (previous && orderedFromPrevious(all, order, previous)) ?? arranged(all, order);
  const ranks = new Map<T, number>();
  ordered.forEach((item, rank) => ranks.set(item, rank));
  const rankOf = (item: T): number | undefined => ranks.get(item);
  const lastIfUnranked = (item: T): number => ranks.get(item) ?? Number.MAX_SAFE_INTEGER;
  return {
    ordered,
    rankOf,
    compare: (a, b) => lastIfUnranked(a) - lastIfUnranked(b),
    arrange: (items) => pickInRankOrder(items, ordered, rankOf),
  };
}

/** A list's ranking for one sort (`rankedOrder`), and the sort it is for. */
export interface ListRanking<T> {
  sort: FileListSort;
  /** Undefined for the path order the items already come in. */
  order: RankedOrder<T> | undefined;
}

/**
 * The ranking of `all` for `sort`, starting from `last`, the ranking of a read before, only when it was for the same
 * sort: a name order that kept the items as a status order had them would be a status order.
 */
export function rankList<T extends { path: string }>(all: readonly T[], sort: FileListSort, facts: FileListFacts<T>, last: ListRanking<T> | undefined): ListRanking<T> {
  const order = fileListOrder(sort, facts);
  return { sort, order: order && rankedOrder(all, order, last?.sort === sort ? last.order : undefined) };
}

/**
 * `items` in the order of their ranks among `ordered`, items without one last: each rank looked up once, and the ranks
 * sorted as numbers (a typed array's own sort), never through a function. A filter can leave any share of a million
 * changes, then split in a group per changelist and status: sorting a group by a function looking ranks up took a
 * second for 900,000 changes, and placing items in a slot per rank went over every rank for each group.
 */
function pickInRankOrder<T>(items: readonly T[], ordered: readonly T[], rankOf: (item: T) => number | undefined): T[] {
  const itemRanks = new Uint32Array(items.length);
  const unranked: T[] = [];
  let ranked = 0;
  for (const item of items) {
    const rank = rankOf(item);
    if (rank === undefined) unranked.push(item);
    else itemRanks[ranked++] = rank;
  }
  const picked: T[] = [];
  for (const rank of itemRanks.subarray(0, ranked).sort()) picked.push(ordered[rank]!);
  for (const item of unranked) picked.push(item);
  return picked;
}

/**
 * `all` in `order`, from `previous`, the ranking of a read before: the items still in it, found by their ranks, keep
 * their order, and the others, put in order on their own, each find their place among those by a binary search, in
 * about log n comparisons. A read of a million changes where one file was edited compares about 20 names, where
 * going over every item kept compared half a million (0.5 s), and arranging them all again read every one.
 * Undefined when fewer than half the items are still there: arranging them afresh costs less.
 */
function orderedFromPrevious<T extends { path: string }>(all: readonly T[], order: ItemOrder<T>, previous: RankedOrder<T>): T[] | undefined {
  const stillListed = new Uint8Array(previous.ordered.length);
  const added: T[] = [];
  for (const item of all) {
    const rank = previous.rankOf(item);
    if (rank === undefined) added.push(item);
    else stillListed[rank] = 1;
  }
  const kept = previous.ordered.filter((_, rank) => stillListed[rank] === 1);
  if (kept.length < all.length / 2) return undefined;
  // Ties between a kept item and an added one go by path, as arranging items that come in path order leaves them.
  const before = (a: T, b: T): boolean => (order.compare(a, b) || comparePaths(a.path, b.path)) <= 0;
  return mergedInOrder(kept, arranged(added, order), before);
}

/** `added` merged into `kept`, both in order: each added item's place found by a binary search from the last one's. */
function mergedInOrder<T>(kept: readonly T[], added: readonly T[], before: (a: T, b: T) => boolean): T[] {
  const merged: T[] = [];
  let next = 0;
  for (const item of added) {
    let [low, high] = [next, kept.length];
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (before(kept[middle]!, item)) low = middle + 1;
      else high = middle;
    }
    while (next < low) merged.push(kept[next++]!);
    merged.push(item);
  }
  while (next < kept.length) merged.push(kept[next++]!);
  return merged;
}
