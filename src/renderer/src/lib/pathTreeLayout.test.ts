import { describe, expect, it } from 'vitest';
import { comparePaths } from '@shared/pathOrder';
import { countCalls } from '@shared/testing/countCalls';
import { countedArray, readGrowthWhenDoubled } from '@shared/testing/countedReads';
import { itemsIn } from './itemRange';
import type { PathTreeRow, TreeFolderRow } from './pathTree';
import { layoutPathTree } from './pathTreeLayout';

interface Item {
  path: string;
}

const keyOf = (item: Item): string => item.path;
const sortedItems = (paths: string[]): Item[] => paths.map((path) => ({ path })).sort((a, b) => comparePaths(a.path, b.path));
const tree = (paths: string[]): PathTreeRow<Item>[] => layoutPathTree({ sorted: sortedItems(paths), keyOf, folderScope: 'all' });
const shape = (rows: PathTreeRow<Item>[]) => rows.map((row) => [row.type === 'folder' ? `${row.name}/` : row.key, row.depth]);

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
const NAMES = ['a', 'b', 'A', 'Lap_2', 'Lap_10', 'lap_3', 'v01', 'v1', 'café', 'café', 'src', 'src-old', 'x.txt', 'x'];

/**
 * Paths at random depths, some of them folders that are items themselves, runs of folders holding only the next, and
 * some listed twice (a merge can list two conflicts on one path).
 */
function randomPaths(random: () => number, count: number): string[] {
  const pick = (names: string[]): string => names[Math.floor(random() * names.length)]!;
  const paths = new Set<string>();
  for (let index = 0; index < count; index++) {
    const depth = Math.floor(random() * 7);
    const names = Array.from({ length: depth + 1 }, () => pick(NAMES));
    if (random() < 0.2) names.splice(1, 0, 'chain', 'of', 'folders');
    paths.add(names.join('/'));
    // A folder that is an item itself: an added or moved folder.
    if (depth > 0 && random() < 0.25) paths.add(names.slice(0, 1 + Math.floor(random() * depth)).join('/'));
  }
  return [...paths].flatMap((path) => (random() < 0.1 ? [path, path] : [path]));
}

describe('layoutPathTree', () => {
  it('gives folders whose names read the same (v01 and v1) a row each, with their own files', () => {
    expect(shape(tree(['Levels/v01/a.txt', 'Levels/v1/b.txt', 'Levels/v01/c.txt']))).toEqual([
      ['Levels/', 0],
      ['v01/', 1],
      ['Levels/v01/a.txt', 2],
      ['Levels/v01/c.txt', 2],
      ['v1/', 1],
      ['Levels/v1/b.txt', 2],
    ]);
  });

  it('puts each folder before what it holds, one level deeper', () => {
    expect(shape(tree(['src/lib/c.ts', 'src/b.ts', 'z.ts']))).toEqual([
      ['src/', 0],
      ['src/b.ts', 1],
      ['lib/', 1],
      ['src/lib/c.ts', 2],
      ['z.ts', 0],
    ]);
  });

  it('shows folders that only hold the next one as one row, named by their path', () => {
    expect(shape(tree(['deep/very/long/a.ts', 'deep/very/other/b.ts']))).toEqual([
      ['deep/very/', 0],
      ['long/', 1],
      ['deep/very/long/a.ts', 2],
      ['other/', 1],
      ['deep/very/other/b.ts', 2],
    ]);
  });

  it('shows a folder that is an item itself as its folder row, holding its own item and those in it', () => {
    const rows = tree(['assets', 'assets/a.png', 'assets/b.png']);
    expect(shape(rows)).toEqual([
      ['assets/', 0],
      ['assets/a.png', 1],
      ['assets/b.png', 1],
    ]);
    expect(rows[0]).toMatchObject({ item: { path: 'assets' } });
    expect(rows[0]!.type === 'folder' && itemsIn(rows[0]!.held)).toEqual([{ path: 'assets' }, { path: 'assets/a.png' }, { path: 'assets/b.png' }]);
  });

  it('ends a row of folders at a folder that is an item itself, so it keeps its status', () => {
    expect(shape(tree(['a/new', 'a/new/x/f.ts']))).toEqual([
      ['a/new/', 0],
      ['x/', 1],
      ['a/new/x/f.ts', 2],
    ]);
  });

  it('starts a row of folders below a folder that is an item, and ends one at a folder that is an item', () => {
    const rows = tree(['top', 'top/one/two/f.ts', 'deep/very/new', 'deep/very/new/g.ts']);
    expect(shape(rows)).toEqual([
      ['deep/very/new/', 0],
      ['deep/very/new/g.ts', 1],
      ['top/', 0],
      ['one/two/', 1],
      ['top/one/two/f.ts', 2],
    ]);
    expect(rows.map((row) => row.type === 'folder' && row.item?.path)).toEqual(['deep/very/new', false, 'top', undefined, false]);
  });

  it('shows a folder that is an item holding only another folder as a row of its own, above it', () => {
    expect(shape(tree(['a', 'a/b/c.txt', 'a/b/d.txt']))).toEqual([
      ['a/', 0],
      ['b/', 1],
      ['a/b/c.txt', 2],
      ['a/b/d.txt', 2],
    ]);
  });

  it('keeps folders whose names sort tricky apart, each with its own files: numbers, case, a name in two Unicode forms', () => {
    const rows = tree(['Lap_10/a.txt', 'Lap_2/b.txt', 'lap_2/c.txt', 'café/d.txt', 'café/e.txt']);
    expect(rows.flatMap((row) => (row.type === 'folder' ? [[row.path, itemsIn(row.held).map(keyOf)]] : []))).toEqual([
      ['café', ['café/e.txt']],
      ['café', ['café/d.txt']],
      ['lap_2', ['lap_2/c.txt']],
      ['Lap_2', ['Lap_2/b.txt']],
      ['Lap_10', ['Lap_10/a.txt']],
    ]);
  });

  it('gives every folder of generated trees exactly the items in it, and shows every item listed once', () => {
    const random = seededRandom(11);
    for (let trial = 0; trial < 200; trial++) {
      const sorted = sortedItems(randomPaths(random, 1 + Math.floor(random() * 40)));
      const rows = layoutPathTree({ sorted, keyOf, folderScope: 'all' });
      for (const row of rows) {
        if (row.type !== 'folder') continue;
        const inside = sorted.filter((item) => item.path.startsWith(`${row.path}/`));
        expect(itemsIn(row.held)).toEqual(row.item ? [row.item, ...inside] : inside);
      }
      // Each item listed, a path listed twice too, shows once: as a file's row or as its folder's.
      const shown = rows.flatMap((row) => (row.type === 'file' ? [row.item] : row.item ? [row.item] : []));
      expect(new Set(shown).size).toBe(sorted.length);
      expect(shown).toHaveLength(sorted.length);
    }
  });

  it('nests the rows of generated trees as their paths say, sharing a row only among folders holding just the next', () => {
    const random = seededRandom(17);
    // What breaks the rules, gathered and compared once: thousands of rows asked one by one take too long.
    const broken: string[] = [];
    for (let trial = 0; trial < 200; trial++) {
      const sorted = sortedItems(randomPaths(random, 1 + Math.floor(random() * 40)));
      const rows = layoutPathTree({ sorted, keyOf, folderScope: 'all' });
      // The folder rows holding the row at hand, outermost first: each holds the rows until its run ends.
      const open: TreeFolderRow<Item>[] = [];
      rows.forEach((row, at) => {
        const first = row.type === 'folder' ? row.held.start : sorted.indexOf(row.item);
        while (open.length > 0 && open.at(-1)!.held.end <= first) open.pop();
        const parent = open.at(-1);
        if (row.depth !== (parent ? parent.depth + 1 : 0)) broken.push(`depth of row ${at}: ${row.key}`);
        if (row.type !== 'folder') return;
        open.push(row);
        if (row.name !== (parent ? row.path.slice(parent.path.length + 1) : row.path)) broken.push(`name of ${row.key}`);
        if (parent && !row.path.startsWith(`${parent.path}/`)) broken.push(`${row.key} outside ${parent.key}`);
        if (row.item) return;
        // A folder that isn't an item shares its row with the next folder when that folder is all it holds, unless
        // that folder is listed twice: the first shows as a file's row, the second as the folder's.
        const held = itemsIn(row.held);
        const children = new Set(held.map((item) => item.path.slice(row.path.length + 1).split('/')[0]));
        const [only] = children;
        const child = `${row.path}/${only}`;
        const holdsJustAFolder = children.size === 1 && held.some((item) => item.path.startsWith(`${child}/`)) && held.filter((item) => item.path === child).length < 2;
        if (holdsJustAFolder) broken.push(`${row.key} holds only ${child}`);
      });
    }
    expect(broken).toEqual([]);
  });

  it('shows a file listed twice as two rows, not as a folder holding itself', () => {
    expect(shape(tree(['b.txt', 'b.txt']))).toEqual([
      ['b.txt', 0],
      ['b.txt', 0],
    ]);
    expect(shape(tree(['src/a.ts', 'src/a.ts']))).toEqual([
      ['src/', 0],
      ['src/a.ts', 1],
      ['src/a.ts', 1],
    ]);
    // A folder listed twice, holding others: the first is a file's row beside the folder's.
    expect(shape(tree(['a/b', 'a/b', 'a/b/c.ts']))).toEqual([
      ['a/', 0],
      ['a/b', 1],
      ['b/', 1],
      ['a/b/c.ts', 2],
    ]);
  });

  it('lays out no rows for no items', () => {
    expect(tree([])).toEqual([]);
  });

  it('lays out a list without changing it: its folders point into it', () => {
    const sorted = Object.freeze(sortedItems(['src/a.ts', 'src/lib/b.ts', 'z.ts']));
    const [src] = layoutPathTree({ sorted, keyOf, folderScope: 'all' });
    expect(src).toMatchObject({ type: 'folder', held: { list: sorted, start: 0, end: 2 } });
  });

  it('keeps a folder that is an item but holds none a row of an item', () => {
    expect(tree(['empty'])).toEqual([{ type: 'file', key: 'empty', item: { path: 'empty' }, depth: 0 }]);
  });

  it('gives each folder every item in it, at every level', () => {
    const rows = tree(['src/a.ts', 'src/lib/b.ts', 'src/lib/deep/c.ts', 'src-old.ts']);
    expect(rows.flatMap((row) => (row.type === 'folder' ? [[row.path, itemsIn(row.held).map(keyOf)]] : []))).toEqual([
      ['src', ['src/a.ts', 'src/lib/b.ts', 'src/lib/deep/c.ts']],
      ['src/lib', ['src/lib/b.ts', 'src/lib/deep/c.ts']],
      ['src/lib/deep', ['src/lib/deep/c.ts']],
    ]);
  });

  it("keys folder rows by the tree's scope, so two trees on one list never share a key", () => {
    const rows = layoutPathTree({ sorted: sortedItems(['src/a.ts']), keyOf, folderScope: 'changelist:UI' });
    expect(rows[0]!.key).toBe('folder:changelist:UI:src');
  });

  // How the work grows is the test below; 100,000 items on top of it took up to 2 s on CI's runners.
  it('lays out 20,000 items, every item once', () => {
    const paths = Array.from({ length: 20_000 }, (_, index) => `src/m${index % 20}/p${index % 10}/s${index % 5}/f${index}.cs`);
    expect(tree(paths).filter((row) => row.type === 'file')).toHaveLength(20_000);
  });

  it('lays out in n·log n work: twice the items, about twice the reads', () => {
    const many = (count: number) =>
      sortedItems(Array.from({ length: count }, (_, index) => (index % 2 ? `src/m${index % 20}/p${index % 10}/s${index % 5}/f${index}.cs` : `flat/asset${index}.txt`)));
    expect(readGrowthWhenDoubled(5_000, many, (sorted) => layoutPathTree({ sorted, keyOf, folderScope: 'all' }))).toBeLessThan(2.5);
  });

  // Ten folders, each holding a file and the next folder at every level, `depth` of them: each file sits as many
  // folders deep as its index says, so twice the depth puts each file, on average, in twice the folders.
  const filesInFolders = (files: number, depth: number): Item[] =>
    sortedItems(Array.from({ length: files }, (_, index) => [`top${index % 10}`, ...Array.from({ length: index % depth }, (_, level) => `level${level}`), `f${index}.cs`].join('/')));

  // A folder that copied every item under it read each item once per folder it is in: a 50,000-file diff took 50 ms a key.
  it('reads each item about as often however many folders deep it sits', () => {
    const readsAt = (depth: number): number => {
      const { array: sorted, reads } = countedArray(filesInFolders(2_000, depth));
      layoutPathTree({ sorted, keyOf, folderScope: 'all' });
      return reads();
    };
    expect(readsAt(16) / readsAt(8)).toBeLessThan(1.25);
  });

  it('makes the strings of the folders it shows, none for each file in them', () => {
    const slicesFor = (files: number): number => {
      const sorted = filesInFolders(files, 16);
      return countCalls(String.prototype, 'slice', () => layoutPathTree({ sorted, keyOf, folderScope: 'all' })).calls;
    };
    expect(slicesFor(4_000)).toBe(slicesFor(2_000));
  });
});
