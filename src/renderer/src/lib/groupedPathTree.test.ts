import { describe, expect, it } from 'vitest';
import { comparePaths } from '@shared/pathOrder';
import { collapseGroupedTreeRows, groupedRowLevel, groupedRowsHolding, groupedTreeKeyMove, groupLevelsOf, hasChevronColumn, layoutGroupedTree, type GroupedTreeRow, type TreeGroup } from './groupedPathTree';
import { itemsIn } from './itemRange';
import { itemsUnderRows } from './pathTree';
import { layoutPathTree } from './pathTreeLayout';

interface Item {
  path: string;
}

const keyOf = (item: Item): string => item.path;
const sortedItems = (paths: string[]): Item[] => paths.map((path) => ({ path })).sort((a, b) => comparePaths(a.path, b.path));
const group = (key: string, paths: string[]): TreeGroup<Item, string> => ({ key, label: key.toUpperCase(), group: key, sorted: sortedItems(paths) });
const nested = (key: string, subgroups: TreeGroup<Item, string>[]): TreeGroup<Item, string> => ({
  key,
  label: key.toUpperCase(),
  group: key,
  sorted: subgroups.flatMap((subgroup) => subgroup.sorted).sort((a, b) => comparePaths(a.path, b.path)),
  subgroups,
});
const shape = (rows: GroupedTreeRow<Item, string>[]) => {
  const groupLevels = groupLevelsOf(rows);
  return rows.map((row) => [row.type === 'group' ? `[${row.label}]` : row.type === 'folder' ? `${row.name}/` : row.key, groupedRowLevel(row, groupLevels)]);
};
const byName = { compare: (a: Item, b: Item): number => (a.path.split('/').at(-1)! < b.path.split('/').at(-1)! ? -1 : 1) };

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

  it('lays groups out inside groups, each a level in, with their items a level further', () => {
    const rows = layoutGroupedTree([nested('default', [group('default:added', ['src/a.ts']), group('default:changed', ['z.ts'])]), nested('ui', [group('ui:changed', ['b.ts'])])], keyOf, true);
    expect(shape(rows)).toEqual([
      ['[DEFAULT]', 0],
      ['[DEFAULT:ADDED]', 1],
      ['src/', 2],
      ['src/a.ts', 3],
      ['[DEFAULT:CHANGED]', 1],
      ['z.ts', 2],
      ['[UI]', 0],
      ['[UI:CHANGED]', 1],
      ['b.ts', 2],
    ]);
  });

  it("gives a group that holds others every item in them, for its count and its check", () => {
    const [header] = layoutGroupedTree([nested('default', [group('a', ['x.ts']), group('b', ['w.ts'])])], keyOf, false);
    expect(itemsUnderRows([header!]).map(keyOf)).toEqual(['w.ts', 'x.ts']);
  });

  it("orders each group's items, the files of each folder in a tree", () => {
    const sorted = (tree: boolean) => shape(layoutGroupedTree([group('changes', ['b/z.ts', 'a/y.ts', 'b/x.ts'])], keyOf, tree, byName));
    expect(sorted(false).map(([name]) => name)).toEqual(['[CHANGES]', 'b/x.ts', 'a/y.ts', 'b/z.ts']);
    expect(sorted(true).map(([name]) => name)).toEqual(['[CHANGES]', 'a/', 'a/y.ts', 'b/', 'b/x.ts', 'b/z.ts']);
  });

  it("points each group's folders into that group's own list", () => {
    const groups = [group('conflicts', ['src/a.ts', 'src/b.ts']), group('changes', ['src/c.ts', 'z.ts'])];
    const folders = layoutGroupedTree(groups, keyOf, true).filter((row) => row.type === 'folder');
    expect(folders.map((row) => row.type === 'folder' && [row.key, row.held.list === groups[0]!.sorted, itemsIn(row.held).map(keyOf)])).toEqual([
      ['folder:conflicts:src', true, ['src/a.ts', 'src/b.ts']],
      ['folder:changes:src', false, ['src/c.ts']],
    ]);
    expect(folders[1]!.type === 'folder' && folders[1]!.held.list).toBe(groups[1]!.sorted);
  });

  it('gives a group every item it holds, for its count and for what acting on it means', () => {
    const [header] = layoutGroupedTree([group('changes', ['src/b.ts', 'z.ts'])], keyOf, true);
    expect(itemsUnderRows([header!]).map(keyOf)).toEqual(['src/b.ts', 'z.ts']);
  });
});

describe('groupLevelsOf', () => {
  it('counts no levels without groups, one with groups, and two with groups inside groups', () => {
    expect(groupLevelsOf(layoutPathTree({ sorted: sortedItems(['a.ts']), keyOf, folderScope: 'all' }))).toBe(0);
    expect(groupLevelsOf(layoutGroupedTree([group('one', ['a.ts'])], keyOf, true))).toBe(1);
    expect(groupLevelsOf(layoutGroupedTree([nested('one', [group('one:a', ['a.ts'])])], keyOf, true))).toBe(2);
  });

  it('still counts two while the first group is closed, from the subgroups of the next', () => {
    const rows = layoutGroupedTree([nested('one', [group('one:a', ['a.ts'])]), nested('two', [group('two:a', ['b.ts'])])], keyOf, true);
    expect(groupLevelsOf(collapseGroupedTreeRows(rows, new Set(['one'])))).toBe(2);
  });
});

describe('hasChevronColumn', () => {
  it('leaves the chevron column in a tree or once grouped, so files start under a group\'s name; a flat list stays flush', () => {
    expect(hasChevronColumn(0, false)).toBe(false);
    expect(hasChevronColumn(0, true)).toBe(true);
    expect(hasChevronColumn(1, false)).toBe(true);
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

describe('groupedRowsHolding', () => {
  it("names a file's folders, then its group: opening them shows it", () => {
    const rows = layoutGroupedTree([group('one', ['x.ts']), group('two', ['src/lib/b.ts'])], keyOf, true);
    expect(groupedRowsHolding(rows, 'src/lib/b.ts')).toEqual(['folder:two:src/lib', 'two']);
  });

  it('names the subgroup, then the group, of a file in groups inside groups', () => {
    const rows = layoutGroupedTree([nested('one', [group('one:a', ['a.ts'])])], keyOf, false);
    expect(groupedRowsHolding(rows, 'a.ts')).toEqual(['one:a', 'one']);
  });

  it('closes a subgroup alone, or everything in its group', () => {
    const rows = layoutGroupedTree([nested('one', [group('one:a', ['a.ts']), group('one:b', ['b.ts'])])], keyOf, false);
    expect(collapseGroupedTreeRows(rows, new Set(['one:a'])).map((row) => row.key)).toEqual(['one', 'one:a', 'one:b', 'b.ts']);
    expect(collapseGroupedTreeRows(rows, new Set(['one'])).map((row) => row.key)).toEqual(['one']);
  });

  it('names only the group in a list', () => {
    const rows = layoutGroupedTree([group('one', ['src/a.ts'])], keyOf, false);
    expect(groupedRowsHolding(rows, 'src/a.ts')).toEqual(['one']);
  });
});
