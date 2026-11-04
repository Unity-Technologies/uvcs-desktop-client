import { describe, expect, it } from 'vitest';
import { compareNames, comparePaths } from '@shared/pathOrder';
import { layoutGroupedTree, type GroupedTreeRow, type TreeGroup } from './groupedPathTree';
import { layoutPathItems, layoutPathTree, orderTreeRows, type ItemOrder, type PathTreeRow, type TreeFolderRow } from './pathTree';

// The layout as it was before folders stopped copying their items, kept here only to prove the new one lays out the
// same rows. It goes once the specific tests pin what these generated trees found.
function layoutPathTreeAsBefore<T extends { path: string }>(sorted: readonly T[], keyOf: (item: T) => string, folderScope: string): PathTreeRow<T>[] {
  const rows: PathTreeRow<T>[] = [];
  const byPath = new Map(sorted.map((item) => [item.path, item]));
  const prefixes = sorted.map((item) => pathPrefixes(item.path));
  const folders = new Set<string>();
  for (const paths of prefixes) for (let level = 0; level < paths.length - 1; level++) folders.add(paths[level]!);
  const folderRows = new Map<string, TreeFolderRow<T>>();
  const lastLevels = new Map<TreeFolderRow<T>, number>();
  sorted.forEach((item, index) => {
    const paths = prefixes[index]!;
    const pathAt = (level: number): string => paths[level]!;
    const isFolder = folders.has(item.path);
    const folderCount = isFolder ? paths.length : paths.length - 1;
    let depth = 0;
    for (let level = 0; level < folderCount; level++) {
      let row = folderRows.get(pathAt(level));
      if (!row) {
        const inside = itemsInFolder(sorted, index, pathAt(level));
        let last = level;
        while (last + 1 < folderCount && !byPath.has(pathAt(last)) && holdsOnly(inside, pathAt(last + 1))) last++;
        const path = pathAt(last);
        row = {
          type: 'folder',
          key: `folder:${folderScope}:${path}`,
          path,
          name: level === 0 ? path : path.slice(pathAt(level - 1).length + 1),
          depth,
          item: byPath.get(path),
          items: inside,
          collapsed: false,
        };
        rows.push(row);
        lastLevels.set(row, last);
        for (let chained = level; chained <= last; chained++) folderRows.set(pathAt(chained), row);
      }
      level = lastLevels.get(row)!;
      depth = row.depth + 1;
    }
    if (!isFolder) rows.push({ type: 'file', key: keyOf(item), item, depth });
  });
  return rows;
}

function holdsOnly<T extends { path: string }>(inside: T[], child: string): boolean {
  return [inside[0]!, inside.at(-1)!].every((item) => item.path === child || item.path.startsWith(`${child}/`));
}

function itemsInFolder<T extends { path: string }>(sorted: readonly T[], first: number, folder: string): T[] {
  const inside = `${folder}/`;
  let end = first;
  while (end < sorted.length && (sorted[end]!.path === folder || sorted[end]!.path.startsWith(inside))) end++;
  return sorted.slice(first, end);
}

function pathPrefixes(path: string): string[] {
  const prefixes: string[] = [];
  for (let end = path.indexOf('/'); end !== -1; end = path.indexOf('/', end + 1)) prefixes.push(path.slice(0, end));
  prefixes.push(path);
  return prefixes;
}

function layoutGroupedTreeAsBefore<T extends { path: string }, G>(groups: readonly TreeGroup<T, G>[], keyOf: (item: T) => string, order?: ItemOrder<T>): GroupedTreeRow<T, G>[] {
  const rows: GroupedTreeRow<T, G>[] = [];
  const layOut = (inGroups: readonly TreeGroup<T, G>[], depth: number): void => {
    for (const { key, label, group, sorted, subgroups } of inGroups) {
      rows.push({ type: 'group', key, label, group, items: [...sorted], depth, collapsed: false });
      if (subgroups) {
        layOut(subgroups, depth + 1);
        continue;
      }
      const tree = layoutPathTreeAsBefore(sorted, keyOf, key);
      rows.push(...(order ? orderTreeRows(tree, order) : tree));
    }
  };
  layOut(groups, 0);
  return rows;
}

interface Item {
  path: string;
  tone: number;
}

const keyOf = (item: Item): string => `item:${item.path}`;

/** A seeded source of numbers in [0, 1): the same trees at every run. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

// Names that sort tricky: numbers read as numbers, case only between names otherwise equal, names that read the same
// ("v01" and "v1", "café" composed and decomposed), and a name that is another's start ("src" and "src-old").
const NAMES = ['a', 'b', 'A', 'Lap_2', 'Lap_10', 'lap_3', 'v01', 'v1', 'café', 'café', 'src', 'src-old', 'x.txt', 'x', 'deep', 'only'];

/** Paths at random depths, some of them folders that are items themselves, and long runs of folders holding only the next. */
function randomPaths(random: () => number, count: number): string[] {
  const pick = <V,>(values: readonly V[]): V => values[Math.floor(random() * values.length)]!;
  const paths = new Set<string>();
  for (let index = 0; index < count; index++) {
    const depth = Math.floor(random() * 7);
    const segments = Array.from({ length: depth + 1 }, () => pick(NAMES));
    if (random() < 0.2) segments.splice(1, 0, 'chain', 'of', 'folders');
    const path = segments.join('/');
    paths.add(path);
    // A folder that is an item itself: an added or moved folder.
    if (depth > 0 && random() < 0.25) paths.add(segments.slice(0, 1 + Math.floor(random() * depth)).join('/'));
  }
  return [...paths];
}

const sortedItems = (paths: string[], random: () => number): Item[] =>
  Object.freeze(paths.map((path) => ({ path, tone: Math.floor(random() * 3) })).sort((a, b) => comparePaths(a.path, b.path))) as Item[];

/** A row as the user sees it, with the items a folder or a group holds. */
function seen(row: GroupedTreeRow<Item, number>): unknown {
  if (row.type === 'file') return row;
  const { items, ...rest } = row;
  return { ...rest, held: items.map(keyOf) };
}

const lastName = (item: Item): string => item.path.slice(item.path.lastIndexOf('/') + 1);
const ORDERS: [string, ItemOrder<Item> | undefined][] = [
  ['by path', undefined],
  ['by name', { compare: (a, b) => compareNames(lastName(a), lastName(b)) }],
  ['by tone', { compare: (a, b) => a.tone - b.tone }],
];

const TREES = 300;

describe('layoutPathTree, against the layout before folders stopped copying their items', () => {
  it('lays out no rows for no items, and one for one file', () => {
    expect(layoutPathTree({ sorted: [], keyOf, folderScope: 'all' })).toEqual([]);
    const one = sortedItems(['a.txt'], seededRandom(1));
    expect(layoutPathTree({ sorted: one, keyOf, folderScope: 'all' }).map(seen)).toEqual(layoutPathTreeAsBefore(one, keyOf, 'all').map(seen));
  });

  it.each(ORDERS)('lays out the same rows, holding the same items, for generated trees %s', (_, order) => {
    const random = seededRandom(11);
    for (let tree = 0; tree < TREES; tree++) {
      const sorted = sortedItems(randomPaths(random, 1 + Math.floor(random() * 40)), random);
      const before = layoutPathTreeAsBefore(sorted, keyOf, 'all');
      const expected = order ? orderTreeRows(before, order) : before;
      expect(layoutPathItems(sorted, keyOf, { tree: true, folderScope: 'all', order }).map(seen)).toEqual(expected.map(seen));
    }
  });

  it.each(ORDERS)('lays out the same groups, each a tree of its own items, for generated trees %s', (_, order) => {
    const random = seededRandom(23);
    for (let tree = 0; tree < TREES; tree++) {
      const sorted = sortedItems(randomPaths(random, 1 + Math.floor(random() * 40)), random);
      const groupOf = (tone: number, scope: string): TreeGroup<Item, number> => ({
        key: `${scope}:${tone}`,
        label: String(tone),
        group: tone,
        sorted: Object.freeze(sorted.filter((item) => item.tone === tone)) as Item[],
      });
      const byTone = (scope: string) => [0, 1, 2].map((tone) => groupOf(tone, scope));
      const nested: TreeGroup<Item, number>[] = [{ key: 'all', label: 'All', group: -1, sorted, subgroups: byTone('all') }];
      for (const groups of [byTone('top'), nested]) {
        expect(layoutGroupedTree(groups, keyOf, true, order).map(seen)).toEqual(layoutGroupedTreeAsBefore(groups, keyOf, order).map(seen));
      }
    }
  });
});
