import { describe, expect, it, vi } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { comparePaths } from '@shared/pathOrder';
import { readGrowthWhenDoubled } from '@shared/testing/countedReads';
import type { FileListLayout } from '../../components/fileListLayoutStore';
import { treeArrowMove } from '../../lib/treeArrowMove';
import { rowCheckState } from './changeRowChecks';
import { changeTreeArrowRows, LEVEL_INDENT, rowIndent, topLevelCheckboxInset, treeLevel } from './changeRowLevels';
import { sortChanges } from './changeOrder';
import { changesUnderRow, collapseRows, layoutChangeRows, menuTargetOf, type ChangeRow, type ChangesGrouping } from './changeRows';

vi.mock('@shared/pathOrder', async (original) => {
  const actual = await original<typeof import('@shared/pathOrder')>();
  return { ...actual, comparePaths: vi.fn(actual.comparePaths) };
});

type BuildInput = Omit<Parameters<typeof layoutChangeRows>[0], 'sorted'> & { changes: PendingChange[]; collapsed: ReadonlySet<string> };

/** The rows the list shows, for changes in any order: the view sorts them before they're laid out (`useSortedChanges`). */
function buildChangeRows({ collapsed, changes, ...layout }: BuildInput): ChangeRow[] {
  return collapseRows(layoutChangeRows({ ...layout, sorted: sortChanges(changes) }), collapsed);
}

function change(path: string, kinds: PendingChange['kinds'], changelist?: string): PendingChange {
  return { path, kinds, itemType: 'file', size: 0, lastModified: '', changelist };
}

const changes = [change('src/b.ts', ['changed']), change('src/a.ts', ['checkedOut', 'changed'], 'UI'), change('new.txt', ['private']), change('src/lib/c.ts', ['added'])];
/** src/b.ts and src/lib/c.ts: a folder in a folder. */
const nested = [changes[3]!, changes[0]!];
const base = {
  changes,
  changelists: [],
  layout: 'list' as FileListLayout,
  grouping: 'none' as ChangesGrouping,
  collapsed: new Set<string>(),
};

describe('buildChangeRows', () => {
  it('lists every change without a header, by path', () => {
    const rows = buildChangeRows(base);
    expect(rows.map((row) => row.key)).toEqual(['change:new.txt', 'change:src/a.ts', 'change:src/b.ts', 'change:src/lib/c.ts']);
  });

  it('reports a mixed check state when only some changes are checked', () => {
    const rows = buildChangeRows({ ...base, grouping: 'changelist' });
    expect(rows[0]).toMatchObject({ type: 'group' });
    expect(rowCheckState(rows[0]!, (item) => item.path === 'src/b.ts')).toBe('mixed');
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
    expect(rows.filter((row) => row.type === 'group').map((row) => [row.key, row.type === 'group' && row.items.length])).toEqual([
      ['changelist:', 3],
      ['changelist:UI', 1],
      ['changelist:Empty', 0],
    ]);
  });

  it('nests changes under their folders in tree layout', () => {
    const rows = buildChangeRows({ ...base, changes: nested, layout: 'tree' });
    expect(rows.map((row) => [row.key, row.type === 'group' ? -1 : row.depth])).toEqual([
      ['folder:all:src', 0],
      ['change:src/b.ts', 1],
      ['folder:all:src/lib', 1],
      ['change:src/lib/c.ts', 2],
    ]);
  });

  it('shows folders that only hold the next one as one row, named by their path', () => {
    const paths = ['deep/very/long/a.ts', 'deep/very/long/b.ts', 'deep/very/other/c.ts', 'z.ts'];
    const rows = buildChangeRows({ ...base, changes: paths.map((path) => change(path, ['changed'])), layout: 'tree' });
    expect(rows.map((row) => [row.key, row.type === 'folder' ? row.name : '', row.type === 'group' ? -1 : row.depth])).toEqual([
      ['folder:all:deep/very', 'deep/very', 0],
      ['folder:all:deep/very/long', 'long', 1],
      ['change:deep/very/long/a.ts', '', 2],
      ['change:deep/very/long/b.ts', '', 2],
      ['folder:all:deep/very/other', 'other', 1],
      ['change:deep/very/other/c.ts', '', 2],
      ['change:z.ts', '', 0],
    ]);
    const collapsedChain = buildChangeRows({ ...base, changes: paths.map((path) => change(path, ['changed'])), layout: 'tree', collapsed: new Set(['folder:all:deep/very']) });
    expect(collapsedChain.map((row) => row.key)).toEqual(['folder:all:deep/very', 'change:z.ts']);
  });

  it('ends a row of folders at a folder that is a change itself, so it keeps its status', () => {
    const folder = { ...change('a/new', ['added']), itemType: 'directory' as const };
    const rows = buildChangeRows({ ...base, changes: [folder, change('a/new/x/f.ts', ['added'])], layout: 'tree' });
    expect(rows.map((row) => [row.key, row.type === 'folder' ? row.name : ''])).toEqual([
      ['folder:all:a/new', 'a/new'],
      ['folder:all:a/new/x', 'x'],
      ['change:a/new/x/f.ts', ''],
    ]);
    expect(rows[0]).toMatchObject({ item: folder });
  });

  it('shows a folder that is a change itself as the row of its folder, holding its own change and its files', () => {
    const folder = { ...change('privs', ['private']), itemType: 'directory' as const };
    const rows = buildChangeRows({ ...base, changes: [change('privs/a.txt', ['private']), folder, change('private.txt', ['private'])], layout: 'tree' });
    expect(rows.map((row) => row.key)).toEqual(['change:private.txt', 'folder:all:privs', 'change:privs/a.txt']);
    expect(rows[1]).toMatchObject({ item: folder });
    expect(rowCheckState(rows[1]!, (item) => item !== folder)).toBe('mixed');
    expect(changesUnderRow(rows[1]!).map((item) => item.path)).toEqual(['privs', 'privs/a.txt']);
  });

  it('gives each folder every change in it, at every level', () => {
    const paths = ['src/a.ts', 'src/lib/b.ts', 'src/lib/deep/c.ts', 'src-old.ts', 'z.ts'];
    const rows = buildChangeRows({ ...base, changes: paths.map((path) => change(path, ['changed'])), layout: 'tree' });
    const folderContents = rows.filter((row) => row.type === 'folder').map((row) => [row.path, changesUnderRow(row).map((item) => item.path)]);
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
    const directories = rows.filter((row) => row.type === 'folder').map((row) => row.key);
    expect(new Set(directories).size).toBe(directories.length);
    const underA = rows.findIndex((row) => row.key === 'folder:all:a');
    expect(rows.slice(underA + 1, underA + 3).map((row) => row.key)).toEqual(['change:a/b.txt', 'change:a/c.txt']);
    const underSrc = rows.findIndex((row) => row.key === 'folder:all:Src');
    expect(rows.slice(underSrc + 1, underSrc + 3).map((row) => row.key)).toEqual(['change:Src/a.ts', 'change:Src/c.ts']);
  });

  it('checks folders by what they hold that can be checked in, and offers no check where that is nothing', () => {
    const rows = buildChangeRows({
      ...base,
      changes: [change('bin/out.log', ['ignored']), change('src/a.ts', ['changed']), change('src/build.log', ['ignored'])],
      layout: 'tree',
    });
    expect(rows.filter((row) => row.type === 'folder').map((row) => [row.path, row.type === 'folder' && rowCheckState(row, () => true)])).toEqual([
      ['bin', null],
      ['src', true],
    ]);
    const files = rows.filter((row) => row.type === 'file');
    expect(files.map((row) => rowCheckState(row, (item) => item.path !== 'src/a.ts'))).toEqual([null, false, null]);
  });

  it('hides the contents of collapsed folders', () => {
    const rows = buildChangeRows({
      ...base,
      changes: [change('src/a.ts', ['changed']), change('src/b.ts', ['changed']), change('z.ts', ['changed'])],
      layout: 'tree',
      collapsed: new Set(['folder:all:src']),
    });
    expect(rows.map((row) => row.key)).toEqual(['folder:all:src', 'change:z.ts']);
  });

  it('leaves out what collapsed changelists and folders hold, and nothing after them', () => {
    const layout = layoutChangeRows({ ...base, sorted: sortChanges(changes), layout: 'tree', grouping: 'changelist', changelists: [{ name: 'UI', description: '' }] });
    expect(layout.map((row) => row.key)).toEqual([
      'changelist:',
      'change:new.txt',
      'folder:changelist::src',
      'change:src/b.ts',
      'folder:changelist::src/lib',
      'change:src/lib/c.ts',
      'changelist:UI',
      'folder:changelist:UI:src',
      'change:src/a.ts',
    ]);
    const shown = collapseRows(layout, new Set(['folder:changelist::src', 'folder:changelist::src/lib', 'changelist:UI']));
    expect(shown.map((row) => [row.key, row.type !== 'file' && row.collapsed])).toEqual([
      ['changelist:', false],
      ['change:new.txt', false],
      ['folder:changelist::src', true],
      ['changelist:UI', true],
    ]);
    expect(collapseRows(layout, new Set())).toBe(layout);
  });
});

describe('changeTreeArrowRows', () => {
  it('lets ← and → close and open changelists and folders, and step between them and their files', () => {
    const rows = buildChangeRows({ ...base, changes: nested, layout: 'tree', grouping: 'changelist', collapsed: new Set(['folder:changelist::src/lib']) });
    const arrowRows = changeTreeArrowRows(rows);
    const at = (key: string) => rows.findIndex((row) => row.key === key);
    expect(rows.map((row) => row.key)).toEqual(['changelist:', 'folder:changelist::src', 'change:src/b.ts', 'folder:changelist::src/lib']);
    expect(treeArrowMove(arrowRows, at('folder:changelist::src/lib'), 'ArrowRight')).toEqual({ kind: 'toggle' });
    expect(treeArrowMove(arrowRows, at('folder:changelist::src'), 'ArrowLeft')).toEqual({ kind: 'toggle' });
    expect(treeArrowMove(arrowRows, at('change:src/b.ts'), 'ArrowLeft')).toEqual({ kind: 'moveBy', step: -1 });
    expect(treeArrowMove(arrowRows, at('folder:changelist::src'), 'ArrowRight')).toEqual({ kind: 'moveBy', step: 1 });
    expect(treeArrowMove(arrowRows, at('folder:changelist::src/lib'), 'ArrowLeft')).toEqual({ kind: 'moveBy', step: -2 });
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
    expect((menuTargetOf(row('folder:changelist::src')) as PendingChange[]).map((item) => item.path)).toEqual(['src/b.ts', 'src/lib/c.ts']);
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
    const rootFile = rows.find((row) => row.type === 'file' && row.depth === 0)!;
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
      ['folder', 2],
      ['file', 3],
      ['folder', 3],
      ['file', 4],
    ]);
  });

  it('starts at the first level without changelists', () => {
    const rows = buildChangeRows({ ...base, changes: nested, layout: 'tree' });
    expect(rows.map((row) => treeLevel(row, false))).toEqual([1, 2, 2, 3]);
  });
});

describe('buildChangeRows at scale', () => {
  // Deep and flat at once: 20 × 10 × 5 folders of files, and one folder holding half of them.
  const many = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      index % 2
        ? change(`src/m${index % 20}/p${index % 10}/s${index % 5}/f${index}.cs`, index % 3 ? ['changed'] : ['checkedOut', 'changed'])
        : change(`flat/asset${index}.txt`, index % 4 ? ['private'] : ['added']),
    );
  const layouts: [FileListLayout, ChangesGrouping][] = [
    ['list', 'none'],
    ['tree', 'none'],
    ['tree', 'changelist'],
  ];

  // How the work grows is the test below; this one lays out a list as long as a big project's, every change in it.
  // 100,000 changes took up to 4 s on CI's runners.
  it.each(layouts)('lays out a %s grouped by %s of 20,000 changes, every change once', (layout, grouping) => {
    const rows = buildChangeRows({ ...base, changes: many(20_000), layout, grouping });
    expect(rows.filter((row) => row.type === 'file')).toHaveLength(20_000);
  });

  it.each(layouts)('lays out a %s grouped by %s in n·log n work: twice the changes, about twice the reads', (layout, grouping) => {
    const growth = readGrowthWhenDoubled(5_000, many, (changes) => buildChangeRows({ ...base, changes, layout, grouping }));
    expect(growth).toBeLessThan(2.5);
  });

  // Typing in the filter lays the changes out again on every key: 50,000 of them took 20 ms a key just to be found in
  // order, which they already were (`useSortedChanges`, then filtered).
  it.each(layouts)('lays out a %s grouped by %s of changes handed in order without comparing their paths', (layout, grouping) => {
    const sorted = sortChanges(many(2_000));
    vi.mocked(comparePaths).mockClear();
    layoutChangeRows({ sorted, changelists: [], layout, grouping });
    expect(comparePaths).not.toHaveBeenCalled();
  });
});
