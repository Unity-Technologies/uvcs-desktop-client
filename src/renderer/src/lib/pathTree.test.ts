import { describe, expect, it } from 'vitest';
import { comparePaths } from '@shared/pathOrder';
import { collapseTreeRows, firstFilesOf, folderItemCount, itemsUnderRows, layoutPathItems, layoutPathList, orderTreeRows, pathTreeKeyMove, rowKeyShowing, rowsHolding, type PathTreeRow, type TreeFolderRow } from './pathTree';
import { layoutPathTree } from './pathTreeLayout';

interface Item {
  path: string;
}

const keyOf = (item: Item): string => item.path;
const sortedItems = (paths: string[]): Item[] => paths.map((path) => ({ path })).sort((a, b) => comparePaths(a.path, b.path));
const tree = (paths: string[]): PathTreeRow<Item>[] => layoutPathTree({ sorted: sortedItems(paths), keyOf, folderScope: 'all' });

describe('layoutPathList', () => {
  it('keeps every item at the top level, in the order given', () => {
    expect(layoutPathList(sortedItems(['b/x.ts', 'a.ts']), keyOf).map((row) => [row.key, row.depth])).toEqual([
      ['a.ts', 0],
      ['b/x.ts', 0],
    ]);
  });
});

describe('layoutPathItems', () => {
  // By the file's name, last letter first: an order the path order never gives.
  const byLastLetter = { compare: (a: { path: string }, b: { path: string }): number => a.path.at(-1)!.localeCompare(b.path.at(-1)!) };
  const keys = (rows: PathTreeRow<{ path: string }>[]) => rows.map((row) => (row.type === 'folder' ? `${row.path}/` : row.key));

  it('keeps the path order without an order to follow', () => {
    const sorted = sortedItems(['a/c.ts', 'b.tsx']);
    expect(keys(layoutPathItems(sorted, keyOf, { tree: false, folderScope: 'all' }))).toEqual(['a/c.ts', 'b.tsx']);
    expect(keys(layoutPathItems(sorted, keyOf, { tree: true, folderScope: 'all' }))).toEqual(['a/', 'a/c.ts', 'b.tsx']);
  });

  it('sorts every item of a list, keeping the path order between items the order ties', () => {
    const rows = layoutPathItems(sortedItems(['z/q.tsx', 'a/b.ts', 'm.tsx', 'c.ts']), keyOf, { tree: false, folderScope: 'all', order: byLastLetter });
    expect(keys(rows)).toEqual(['a/b.ts', 'c.ts', 'm.tsx', 'z/q.tsx']);
  });

  it("sorts each folder's files in a tree, after its folders", () => {
    const rows = layoutPathItems(sortedItems(['src/b.tsx', 'src/a.ts', 'src/lib/z.ts', 'readme.ts', 'app.tsx']), keyOf, { tree: true, folderScope: 'all', order: byLastLetter });
    expect(keys(rows)).toEqual(['src/', 'src/lib/', 'src/lib/z.ts', 'src/a.ts', 'src/b.tsx', 'readme.ts', 'app.tsx']);
  });
});

describe('orderTreeRows', () => {
  it('keeps a folder that is an item itself with what it holds', () => {
    const rows = layoutPathTree({ sorted: sortedItems(['new', 'new/b.ts', 'new/a.ts', 'top.ts']), keyOf, folderScope: 'all' });
    const ordered = orderTreeRows(rows, { compare: (a, b) => b.path.localeCompare(a.path) });
    expect(ordered.map((row) => [row.type, row.type === 'folder' ? row.path : row.key, row.depth])).toEqual([
      ['folder', 'new', 0],
      ['file', 'new/b.ts', 1],
      ['file', 'new/a.ts', 1],
      ['file', 'top.ts', 0],
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

describe('folderItemCount', () => {
  const folderCounts = (paths: string[]): number[] =>
    layoutPathTree({ sorted: paths.map((path) => ({ path })), keyOf: (item) => item.path, folderScope: 'test' })
      .filter((row): row is TreeFolderRow<{ path: string }> => row.type === 'folder')
      .map(folderItemCount);

  it('counts what a folder holds, but for the folder itself when it is an item (an added folder)', () => {
    expect(folderCounts(['assets', 'assets/a.png', 'assets/b.png'])).toEqual([2]);
    expect(folderCounts(['src/a.ts', 'src/b.ts'])).toEqual([2]);
  });
});
