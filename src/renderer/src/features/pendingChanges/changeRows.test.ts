import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { buildChangeRows, changesUnderRow, comparePaths, LEVEL_INDENT, menuTargetOf, rowIndent, topLevelCheckboxInset, treeLevel, type ChangesGrouping, type ChangesLayout } from './changeRows';

function change(path: string, kinds: PendingChange['kinds'], changelist?: string): PendingChange {
  return { path, kinds, itemType: 'file', size: 0, lastModified: '', changelist };
}

const changes = [change('src/b.ts', ['changed']), change('src/a.ts', ['checkedOut', 'changed'], 'UI'), change('new.txt', ['private']), change('src/lib/c.ts', ['added'])];
/** src/b.ts and src/lib/c.ts: a folder in a folder. */
const nested = [changes[3]!, changes[0]!];
const base = {
  changes,
  changelists: [],
  layout: 'list' as ChangesLayout,
  grouping: 'none' as ChangesGrouping,
  isChecked: () => true,
  collapsed: new Set<string>(),
};

describe('buildChangeRows', () => {
  it('lists every change without a header, by status in filter order and then by path', () => {
    const rows = buildChangeRows(base);
    expect(rows.map((row) => row.key)).toEqual(['change:src/a.ts', 'change:src/b.ts', 'change:src/lib/c.ts', 'change:new.txt']);
  });

  it('reports a mixed check state when only some changes are checked', () => {
    const rows = buildChangeRows({ ...base, grouping: 'changelist', isChecked: (item) => item.path === 'src/b.ts' });
    expect(rows[0]).toMatchObject({ type: 'group', checkState: 'mixed' });
  });

  it('groups by changelist, keeping empty user changelists visible', () => {
    const rows = buildChangeRows({
      ...base,
      grouping: 'changelist',
      changelists: [
        { name: 'UI', description: '' },
        { name: 'Empty', description: '' },
      ],
    });
    expect(rows.filter((row) => row.type === 'group').map((row) => [row.key, row.type === 'group' && row.changes.length])).toEqual([
      ['changelist:', 3],
      ['changelist:UI', 1],
      ['changelist:Empty', 0],
    ]);
  });

  it('nests changes under their folders in tree layout', () => {
    const rows = buildChangeRows({ ...base, changes: nested, layout: 'tree' });
    expect(rows.map((row) => [row.key, row.type === 'group' ? -1 : row.depth])).toEqual([
      ['directory:all:src', 0],
      ['change:src/b.ts', 1],
      ['directory:all:src/lib', 1],
      ['change:src/lib/c.ts', 2],
    ]);
  });

  it('shows folders that only hold the next one as one row, named by their path', () => {
    const paths = ['deep/very/long/a.ts', 'deep/very/long/b.ts', 'deep/very/other/c.ts', 'z.ts'];
    const rows = buildChangeRows({ ...base, changes: paths.map((path) => change(path, ['changed'])), layout: 'tree' });
    expect(rows.map((row) => [row.key, row.type === 'directory' ? row.name : '', row.type === 'group' ? -1 : row.depth])).toEqual([
      ['directory:all:deep/very', 'deep/very', 0],
      ['directory:all:deep/very/long', 'long', 1],
      ['change:deep/very/long/a.ts', '', 2],
      ['change:deep/very/long/b.ts', '', 2],
      ['directory:all:deep/very/other', 'other', 1],
      ['change:deep/very/other/c.ts', '', 2],
      ['change:z.ts', '', 0],
    ]);
    const collapsedChain = buildChangeRows({ ...base, changes: paths.map((path) => change(path, ['changed'])), layout: 'tree', collapsed: new Set(['directory:all:deep/very']) });
    expect(collapsedChain.map((row) => row.key)).toEqual(['directory:all:deep/very', 'change:z.ts']);
  });

  it('ends a row of folders at a folder that is a change itself, so it keeps its status', () => {
    const folder = { ...change('a/new', ['added']), itemType: 'directory' as const };
    const rows = buildChangeRows({ ...base, changes: [folder, change('a/new/x/f.ts', ['added'])], layout: 'tree' });
    expect(rows.map((row) => [row.key, row.type === 'directory' ? row.name : ''])).toEqual([
      ['directory:all:a/new', 'a/new'],
      ['directory:all:a/new/x', 'x'],
      ['change:a/new/x/f.ts', ''],
    ]);
    expect(rows[0]).toMatchObject({ change: folder });
  });

  it('shows a folder that is a change itself as the row of its folder, holding its own change and its files', () => {
    const folder = { ...change('privs', ['private']), itemType: 'directory' as const };
    const rows = buildChangeRows({ ...base, changes: [change('privs/a.txt', ['private']), folder, change('private.txt', ['private'])], layout: 'tree', isChecked: (item) => item !== folder });
    expect(rows.map((row) => row.key)).toEqual(['change:private.txt', 'directory:all:privs', 'change:privs/a.txt']);
    expect(rows[1]).toMatchObject({ change: folder, checkState: 'mixed' });
    expect(changesUnderRow(rows[1]!).map((item) => item.path)).toEqual(['privs', 'privs/a.txt']);
  });

  it('gives each folder every change in it, at every level', () => {
    const paths = ['src/a.ts', 'src/lib/b.ts', 'src/lib/deep/c.ts', 'src-old.ts', 'z.ts'];
    const rows = buildChangeRows({ ...base, changes: paths.map((path) => change(path, ['changed'])), layout: 'tree' });
    const folderContents = rows.filter((row) => row.type === 'directory').map((row) => [row.path, changesUnderRow(row).map((item) => item.path)]);
    expect(folderContents).toEqual([
      ['src', ['src/a.ts', 'src/lib/b.ts', 'src/lib/deep/c.ts']],
      ['src/lib', ['src/lib/b.ts', 'src/lib/deep/c.ts']],
      ['src/lib/deep', ['src/lib/deep/c.ts']],
    ]);
  });

  it('keeps a folder that is a change but holds none a row of its own', () => {
    const folder = { ...change('empty', ['added']), itemType: 'directory' as const };
    const rows = buildChangeRows({ ...base, changes: [folder], layout: 'tree' });
    expect(rows.map((row) => row.key)).toEqual(['change:empty']);
  });

  it('keeps each folder of the tree in one place, whatever sorts between its path and its files', () => {
    const paths = ['a/c.txt', 'a-b.txt', 'a/b.txt', 'Src/c.ts', 'src/b.ts', 'Src/a.ts'];
    const rows = buildChangeRows({ ...base, changes: paths.map((path) => change(path, ['changed'])), layout: 'tree' });
    const directories = rows.filter((row) => row.type === 'directory').map((row) => row.key);
    expect(new Set(directories).size).toBe(directories.length);
    const underA = rows.findIndex((row) => row.key === 'directory:all:a');
    expect(rows.slice(underA + 1, underA + 3).map((row) => row.key)).toEqual(['change:a/b.txt', 'change:a/c.txt']);
    const underSrc = rows.findIndex((row) => row.key === 'directory:all:Src');
    expect(rows.slice(underSrc + 1, underSrc + 3).map((row) => row.key)).toEqual(['change:Src/a.ts', 'change:Src/c.ts']);
  });

  it('checks folders by what they hold that can be checked in, and offers no check where that is nothing', () => {
    const rows = buildChangeRows({
      ...base,
      changes: [change('bin/out.log', ['ignored']), change('src/a.ts', ['changed']), change('src/build.log', ['ignored'])],
      layout: 'tree',
    });
    expect(rows.filter((row) => row.type === 'directory').map((row) => [row.path, row.type === 'directory' && row.checkState])).toEqual([
      ['bin', null],
      ['src', true],
    ]);
  });

  it('hides the contents of collapsed folders', () => {
    const rows = buildChangeRows({
      ...base,
      changes: [change('src/a.ts', ['changed']), change('src/b.ts', ['changed']), change('z.ts', ['changed'])],
      layout: 'tree',
      collapsed: new Set(['directory:all:src']),
    });
    expect(rows.map((row) => row.key)).toEqual(['directory:all:src', 'change:z.ts']);
  });
});

describe('comparePaths', () => {
  it('puts everything in a folder right after it', () => {
    expect(['a-b.txt', 'a/c.txt', 'a', 'ab'].sort(comparePaths)).toEqual(['a', 'a/c.txt', 'a-b.txt', 'ab']);
  });
});

describe('menuTargetOf', () => {
  const rows = buildChangeRows({
    ...base,
    layout: 'tree',
    grouping: 'changelist',
    changelists: [{ name: 'UI', description: '' }],
  });
  const row = (key: string) => rows.find((candidate) => candidate.key === key)!;

  it("opens a folder's or the default changelist's menu on the changes in it, not on the selected files", () => {
    expect((menuTargetOf(row('directory:changelist::src')) as PendingChange[]).map((item) => item.path)).toEqual(['src/b.ts', 'src/lib/c.ts']);
    expect((menuTargetOf(row('changelist:')) as PendingChange[]).length).toBe(3);
  });

  it("opens a changelist's own menu on its header, and the selection's on a file", () => {
    expect(menuTargetOf(row('changelist:UI'))).toEqual({ name: 'UI', description: '' });
    expect(menuTargetOf(row('change:src/b.ts'))).toBeNull();
    expect(menuTargetOf(null)).toBeNull();
  });
});

describe('rowIndent', () => {
  it('keeps a flat list flush, with the select-all checkbox in the same column', () => {
    const rows = buildChangeRows(base);
    expect(rows.map((row) => rowIndent(row, false))).toEqual([0, 0, 0, 0]);
    expect(topLevelCheckboxInset(rows)).toBe(0);
  });

  it('keeps top-level files where the flat list has them when it becomes a tree', () => {
    const rows = buildChangeRows({ ...base, layout: 'tree' });
    const rootFile = rows.find((row) => row.type === 'change' && row.depth === 0)!;
    expect(rowIndent(rootFile, false)).toBe(0);
    expect(topLevelCheckboxInset(rows)).toBe(0);
  });

  it("puts a folder's chevron in its siblings' checkbox column and its children under its checkbox", () => {
    const rows = buildChangeRows({ ...base, changes: nested, layout: 'tree' });
    expect(rows.map((row) => rowIndent(row, false))).toEqual([0, LEVEL_INDENT, LEVEL_INDENT, 2 * LEVEL_INDENT]);
  });

  it("puts a change under its changelist's checkbox, which the select-all checkbox lines up with", () => {
    const rows = buildChangeRows({ ...base, grouping: 'changelist' });
    expect(rowIndent(rows[0]!, true)).toBe(0);
    expect(rowIndent(rows[1]!, true)).toBe(LEVEL_INDENT);
    expect(topLevelCheckboxInset(rows)).toBe(LEVEL_INDENT);
  });
});

describe('treeLevel', () => {
  it('puts folders and files under their changelist, one level per folder', () => {
    const rows = buildChangeRows({ ...base, changes: nested, layout: 'tree', grouping: 'changelist' });
    expect(rows.map((row) => [row.type, treeLevel(row, true)])).toEqual([
      ['group', 1],
      ['directory', 2],
      ['change', 3],
      ['directory', 3],
      ['change', 4],
    ]);
  });

  it('starts at the first level without changelists', () => {
    const rows = buildChangeRows({ ...base, changes: nested, layout: 'tree' });
    expect(rows.map((row) => treeLevel(row, false))).toEqual([1, 2, 2, 3]);
  });
});
