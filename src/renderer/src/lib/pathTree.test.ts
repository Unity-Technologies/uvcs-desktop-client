import { describe, expect, it } from 'vitest';
import { comparePaths } from '@shared/pathOrder';
import { readGrowthWhenDoubled } from '@shared/testing/countedReads';
import { collapseTreeRows, firstFilesOf, itemsUnderRows, layoutPathList, layoutPathTree, pathTreeKeyMove, rowKeyShowing, rowsHolding, type PathTreeRow } from './pathTree';

interface Item {
  path: string;
}

const keyOf = (item: Item): string => item.path;
const sortedItems = (paths: string[]): Item[] => paths.map((path) => ({ path })).sort((a, b) => comparePaths(a.path, b.path));
const tree = (paths: string[]): PathTreeRow<Item>[] => layoutPathTree({ sorted: sortedItems(paths), keyOf, folderScope: 'all' });
const shape = (rows: PathTreeRow<Item>[]) => rows.map((row) => [row.type === 'folder' ? `${row.name}/` : row.key, row.depth]);

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
    expect(rows[0]).toMatchObject({ item: { path: 'assets' }, items: [{ path: 'assets' }, { path: 'assets/a.png' }, { path: 'assets/b.png' }] });
  });

  it('ends a row of folders at a folder that is an item itself, so it keeps its status', () => {
    expect(shape(tree(['a/new', 'a/new/x/f.ts']))).toEqual([
      ['a/new/', 0],
      ['x/', 1],
      ['a/new/x/f.ts', 2],
    ]);
  });

  it('keeps a folder that is an item but holds none a row of an item', () => {
    expect(tree(['empty'])).toEqual([{ type: 'file', key: 'empty', item: { path: 'empty' }, depth: 0 }]);
  });

  it('gives each folder every item in it, at every level', () => {
    const rows = tree(['src/a.ts', 'src/lib/b.ts', 'src/lib/deep/c.ts', 'src-old.ts']);
    expect(rows.flatMap((row) => (row.type === 'folder' ? [[row.path, row.items.map(keyOf)]] : []))).toEqual([
      ['src', ['src/a.ts', 'src/lib/b.ts', 'src/lib/deep/c.ts']],
      ['src/lib', ['src/lib/b.ts', 'src/lib/deep/c.ts']],
      ['src/lib/deep', ['src/lib/deep/c.ts']],
    ]);
  });

  it("keys folder rows by the tree's scope, so two trees on one list never share a key", () => {
    const rows = layoutPathTree({ sorted: sortedItems(['src/a.ts']), keyOf, folderScope: 'changelist:UI' });
    expect(rows[0]!.key).toBe('folder:changelist:UI:src');
  });

  it('lays out 100,000 items, every item once', () => {
    const paths = Array.from({ length: 100_000 }, (_, index) => `src/m${index % 20}/p${index % 10}/s${index % 5}/f${index}.cs`);
    expect(tree(paths).filter((row) => row.type === 'file')).toHaveLength(100_000);
  });

  it('lays out in n·log n work: twice the items, about twice the reads', () => {
    const many = (count: number) =>
      sortedItems(Array.from({ length: count }, (_, index) => (index % 2 ? `src/m${index % 20}/p${index % 10}/s${index % 5}/f${index}.cs` : `flat/asset${index}.txt`)));
    expect(readGrowthWhenDoubled(5_000, many, (sorted) => layoutPathTree({ sorted, keyOf, folderScope: 'all' }))).toBeLessThan(2.5);
  });
});

describe('layoutPathList', () => {
  it('keeps every item at the top level, in the order given', () => {
    expect(layoutPathList(sortedItems(['b/x.ts', 'a.ts']), keyOf).map((row) => [row.key, row.depth])).toEqual([
      ['a.ts', 0],
      ['b/x.ts', 0],
    ]);
  });
});

describe('pathTreeKeyMove', () => {
  const rows = collapseTreeRows(tree(['src/a.ts', 'src/lib/b.ts', 'z.ts']), new Set(['folder:all:src/lib']), (row) => row.depth);
  const at = (key: string): number => rows.findIndex((row) => row.key === key);

  it('opens and closes folders with Enter, ← and →, and steps into a folder and out to its parent', () => {
    expect(rows.map((row) => row.key)).toEqual(['folder:all:src', 'src/a.ts', 'folder:all:src/lib', 'z.ts']);
    expect(pathTreeKeyMove(rows, at('folder:all:src/lib'), 'Enter')).toEqual({ kind: 'toggle' });
    expect(pathTreeKeyMove(rows, at('folder:all:src/lib'), 'ArrowRight')).toEqual({ kind: 'toggle' });
    expect(pathTreeKeyMove(rows, at('folder:all:src'), 'ArrowLeft')).toEqual({ kind: 'toggle' });
    expect(pathTreeKeyMove(rows, at('folder:all:src'), 'ArrowRight')).toEqual({ kind: 'moveBy', step: 1 });
    expect(pathTreeKeyMove(rows, at('src/a.ts'), 'ArrowLeft')).toEqual({ kind: 'moveBy', step: -1 });
  });

  it('leaves Enter on a file, and every other key, to the list', () => {
    expect(pathTreeKeyMove(rows, at('src/a.ts'), 'Enter')).toBeNull();
    expect(pathTreeKeyMove(rows, at('folder:all:src'), 'ArrowDown')).toBeNull();
    expect(pathTreeKeyMove(rows, at('z.ts'), 'ArrowLeft')).toBeNull();
  });
});

describe('itemsUnderRows', () => {
  it('gives what files and folders stand for, each once, in order', () => {
    const rows = tree(['src/a.ts', 'src/lib/b.ts', 'z.ts']);
    const pick = (...keys: string[]) => rows.filter((row) => keys.includes(row.key));
    expect(itemsUnderRows(pick('folder:all:src', 'src/lib/b.ts', 'z.ts')).map(keyOf)).toEqual(['src/a.ts', 'src/lib/b.ts', 'z.ts']);
    expect(itemsUnderRows(pick('folder:all:src/lib')).map(keyOf)).toEqual(['src/lib/b.ts']);
  });
});

describe('firstFilesOf', () => {
  const rows = tree(['a/1.ts', 'a/2.ts', 'b/c/3.ts', 'd.ts']);

  it('keeps the rows up to the limit of files and counts the files left out', () => {
    const first = firstFilesOf(rows, 2);
    expect(first.rows.map((row) => row.key)).toEqual(['folder:all:a', 'a/1.ts', 'a/2.ts']);
    expect(first.unlistedFiles).toBe(2);
  });

  it('leaves out folders whose files are all left out', () => {
    expect(firstFilesOf(rows, 2).rows.some((row) => row.key === 'folder:all:b/c')).toBe(false);
  });

  it('gives back the very rows when they hold no more files than the limit', () => {
    expect(firstFilesOf(rows, 4)).toEqual({ rows, unlistedFiles: 0 });
  });
});

describe('collapseTreeRows', () => {
  const rows = tree(['src/a.ts', 'src/lib/b.ts', 'z.ts']);
  const levelOf = (row: PathTreeRow<Item>): number => row.depth;

  it('leaves out what a collapsed folder holds, and nothing after it', () => {
    const shown = collapseTreeRows(rows, new Set(['folder:all:src']), levelOf);
    expect(shown.map((row) => [row.key, row.type === 'folder' && row.collapsed])).toEqual([
      ['folder:all:src', true],
      ['z.ts', false],
    ]);
  });

  it('collapses a folder inside another, leaving the outer one open', () => {
    const shown = collapseTreeRows(rows, new Set(['folder:all:src/lib']), levelOf);
    expect(shown.map((row) => row.key)).toEqual(['folder:all:src', 'src/a.ts', 'folder:all:src/lib', 'z.ts']);
  });

  it('gives back the very rows when nothing is collapsed', () => {
    expect(collapseTreeRows(rows, new Set(), levelOf)).toBe(rows);
  });
});

describe('rowKeyShowing', () => {
  const rows = tree(['src', 'src/a.ts', 'z.ts']);

  it("is a file's own row, and a folder's row for an item that is that folder", () => {
    expect(rowKeyShowing(rows, 'src/a.ts', keyOf)).toBe('src/a.ts');
    expect(rowKeyShowing(rows, 'src', keyOf)).toBe('folder:all:src');
  });

  it('is the key itself when no row shows it', () => {
    expect(rowKeyShowing(rows, 'gone.ts', keyOf)).toBe('gone.ts');
  });
});

describe('rowsHolding', () => {
  const rows = tree(['src/a.ts', 'src/lib/b.ts', 'z.ts']);
  const levelOf = (row: PathTreeRow<Item>): number => row.depth;

  it('names every folder above a row, nearest first: opening them shows it', () => {
    expect(rowsHolding(rows, 'src/lib/b.ts', levelOf)).toEqual(['folder:all:src/lib', 'folder:all:src']);
    expect(rowsHolding(rows, 'folder:all:src/lib', levelOf)).toEqual(['folder:all:src']);
  });

  it('names none for a row at the top, or one not laid out', () => {
    expect(rowsHolding(rows, 'z.ts', levelOf)).toEqual([]);
    expect(rowsHolding(rows, 'gone.ts', levelOf)).toEqual([]);
  });
});
