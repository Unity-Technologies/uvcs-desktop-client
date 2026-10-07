import { describe, expect, it } from 'vitest';
import { comparePaths } from '@shared/pathOrder';
import { collapseGroupedTreeRows, groupedRowLevel, groupedTreeKeyMove, layoutGroupedTree, type GroupedTreeRow, type TreeGroup } from './groupedPathTree';
import { itemsUnderRows, layoutPathTree } from './pathTree';

interface Item {
  path: string;
}

const keyOf = (item: Item): string => item.path;
const sortedItems = (paths: string[]): Item[] => paths.map((path) => ({ path })).sort((a, b) => comparePaths(a.path, b.path));
const group = (key: string, paths: string[]): TreeGroup<Item, string> => ({ key, label: key.toUpperCase(), group: key, sorted: sortedItems(paths) });
const shape = (rows: GroupedTreeRow<Item, string>[]) =>
  rows.map((row) => [row.type === 'group' ? `[${row.label}]` : row.type === 'folder' ? `${row.name}/` : row.key, groupedRowLevel(row, true)]);

describe('layoutGroupedTree', () => {
  it("puts each group's header before its items, a level above them, as a tree", () => {
    const rows = layoutGroupedTree([group('conflicts', ['src/a.ts']), group('changes', ['src/b.ts', 'z.ts'])], keyOf, true);
    expect(shape(rows)).toEqual([
      ['[CONFLICTS]', 0],
      ['src/', 1],
      ['src/a.ts', 2],
      ['[CHANGES]', 0],
      ['src/', 1],
      ['src/b.ts', 2],
      ['z.ts', 1],
    ]);
  });

  it("keeps the folders of one group apart from another's of the same path", () => {
    const rows = layoutGroupedTree([group('conflicts', ['src/a.ts']), group('changes', ['src/b.ts'])], keyOf, true);
    expect(rows.filter((row) => row.type === 'folder').map((row) => row.key)).toEqual(['folder:conflicts:src', 'folder:changes:src']);
  });

  it('lists the items of each group by their whole path when the list is flat', () => {
    const rows = layoutGroupedTree([group('changes', ['src/b.ts', 'z.ts'])], keyOf, false);
    expect(shape(rows)).toEqual([
      ['[CHANGES]', 0],
      ['src/b.ts', 1],
      ['z.ts', 1],
    ]);
  });

  it('keeps an empty group, so it still shows', () => {
    expect(shape(layoutGroupedTree([group('empty', [])], keyOf, true))).toEqual([['[EMPTY]', 0]]);
  });

  it('gives a group every item it holds, for its count and for what acting on it means', () => {
    const [header] = layoutGroupedTree([group('changes', ['src/b.ts', 'z.ts'])], keyOf, true);
    expect(itemsUnderRows([header!]).map(keyOf)).toEqual(['src/b.ts', 'z.ts']);
  });
});

describe('collapseGroupedTreeRows', () => {
  const rows = layoutGroupedTree([group('conflicts', ['src/a.ts']), group('changes', ['src/b.ts', 'z.ts'])], keyOf, true);

  it('leaves out what a closed group holds, and marks it closed', () => {
    const shown = collapseGroupedTreeRows(rows, new Set(['conflicts']));
    expect(shown.map((row) => row.key)).toEqual(['conflicts', 'changes', 'folder:changes:src', 'src/b.ts', 'z.ts']);
    expect(shown[0]).toMatchObject({ type: 'group', collapsed: true });
  });

  it("leaves out what a closed folder holds, but not the rest of its group", () => {
    const shown = collapseGroupedTreeRows(rows, new Set(['folder:changes:src']));
    expect(shown.map((row) => row.key)).toEqual(['conflicts', 'folder:conflicts:src', 'src/a.ts', 'changes', 'folder:changes:src', 'z.ts']);
  });

  it('closes the folders of a list without groups by their depth', () => {
    const plain = layoutPathTree({ sorted: sortedItems(['src/a.ts', 'z.ts']), keyOf, folderScope: 'all' });
    expect(collapseGroupedTreeRows(plain, new Set(['folder:all:src'])).map((row) => row.key)).toEqual(['folder:all:src', 'z.ts']);
  });
});

describe('groupedTreeKeyMove', () => {
  const rows = layoutGroupedTree([group('changes', ['src/b.ts', 'z.ts'])], keyOf, true);
  const indexOf = (key: string): number => rows.findIndex((row) => row.key === key);

  it('opens and closes a group with Enter, ← and →, as a folder', () => {
    expect(groupedTreeKeyMove(rows, indexOf('changes'), 'Enter')).toEqual({ kind: 'toggle' });
    expect(groupedTreeKeyMove(rows, indexOf('changes'), 'ArrowLeft')).toEqual({ kind: 'toggle' });
    expect(groupedTreeKeyMove(collapseGroupedTreeRows(rows, new Set(['changes'])), 0, 'ArrowRight')).toEqual({ kind: 'toggle' });
  });

  it('goes from an item at the top of a group out to its header with ←', () => {
    expect(groupedTreeKeyMove(rows, indexOf('z.ts'), 'ArrowLeft')).toEqual({ kind: 'moveBy', step: -indexOf('z.ts') });
  });

  it('does nothing with Enter on a file: that opens it', () => {
    expect(groupedTreeKeyMove(rows, indexOf('z.ts'), 'Enter')).toBeNull();
  });
});
