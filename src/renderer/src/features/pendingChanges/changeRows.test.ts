import { describe, expect, it, vi } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { comparePaths } from '@shared/pathOrder';
import { readGrowthWhenDoubled } from '@shared/testing/countedReads';
import type { FileListLayout } from '../../components/fileListViewStore';
import { rangeLength } from '../../lib/itemRange';
import { treeArrowMove } from '../../lib/treeArrowMove';
import { candidatesUnderRow, checkStateOver } from './changeRowChecks';
import { fileListOrder, rankedOrder } from '../../components/fileListOrder';
import { changeTreeArrowRows, LEVEL_INDENT, rowIndent, rowLevel, rowLevelsOf, topLevelCheckboxInset, treeLevel } from './changeRowLevels';
import { changeTone } from './changeTone';
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
    expect(checkStateOver(candidatesUnderRow(rows[0]!), (item) => item.path === 'src/b.ts')).toBe('mixed');
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
    expect(rows.filter((row) => row.type === 'group').map((row) => [row.key, row.type === 'group' && rangeLength(row.held)])).toEqual([
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
    expect(checkStateOver(candidatesUnderRow(rows[1]!), (item) => item !== folder)).toBe('mixed');
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
    expect(rows.filter((row) => row.type === 'folder').map((row) => [row.path, row.type === 'folder' && checkStateOver(candidatesUnderRow(row), () => true)])).toEqual([
      ['bin', null],
      ['src', true],
    ]);
    const files = rows.filter((row) => row.type === 'file');
    expect(files.map((row) => checkStateOver(candidatesUnderRow(row), (item) => item.path !== 'src/a.ts'))).toEqual([null, false, null]);
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

describe('changeTreeArrowRows in groups inside groups', () => {
  it('steps from a file out to its status group, closes that, then steps out to its changelist', () => {
    const rows = buildChangeRows({ ...base, changes: [change('src/a.ts', ['changed'])], layout: 'tree', grouping: 'changelist', groupByStatus: true });
    const at = (key: string) => rows.findIndex((row) => row.key === key);
    expect(rows.map((row) => row.key)).toEqual(['changelist:', 'status:changelist::changed', 'folder:status:changelist::changed:src', 'change:src/a.ts']);
    const arrowRows = changeTreeArrowRows(rows);
    expect(treeArrowMove(arrowRows, at('change:src/a.ts'), 'ArrowLeft')).toEqual({ kind: 'moveBy', step: -1 });
    expect(treeArrowMove(arrowRows, at('status:changelist::changed'), 'ArrowLeft')).toEqual({ kind: 'toggle' });
    const closed = collapseRows(layoutChangeRows({ ...base, sorted: [change('src/a.ts', ['changed'])], layout: 'tree', grouping: 'changelist', groupByStatus: true }), new Set(['status:changelist::changed']));
    expect(treeArrowMove(changeTreeArrowRows(closed), 1, 'ArrowLeft')).toEqual({ kind: 'moveBy', step: -1 });
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

  it("opens a folder's menu on the changes in it, not on the selected files", () => {
    const target = menuTargetOf(row('folder:changelist::src'));

    expect(target.kind === 'changes' && target.changes.map((item) => item.path)).toEqual(['src/b.ts', 'src/lib/c.ts']);
  });

  it("opens a changelist's own menu on its header, the default changelist's too", () => {
    expect(menuTargetOf(row('changelist:UI'))).toEqual({ kind: 'changelist', changelist: { name: 'UI', description: '' } });
    expect(menuTargetOf(row('changelist:'))).toEqual({ kind: 'changelist', changelist: null });
  });

  it("opens the selection's menu on a file", () => {
    expect(menuTargetOf(row('change:src/b.ts'))).toEqual({ kind: 'selection' });
    expect(menuTargetOf(null)).toEqual({ kind: 'selection' });
  });
});

describe('rowIndent', () => {
  const levelsOf = (rows: ChangeRow[], layout: FileListLayout = 'list') => rowLevelsOf(rows, layout === 'tree');

  it('keeps a flat list flush, with the select-all checkbox in the same column', () => {
    const rows = buildChangeRows(base);
    const levels = levelsOf(rows);
    expect(rows.map((row) => rowIndent(row, levels))).toEqual([0, 0, 0, 0]);
    expect(topLevelCheckboxInset(levels)).toBe(0);
  });

  it("leaves the folders' chevron column in a tree: every top-level checkbox lines up, the select-all one too", () => {
    const rows = buildChangeRows({ ...base, layout: 'tree' });
    const levels = levelsOf(rows, 'tree');
    const rootFile = rows.find((row) => row.type === 'file' && row.depth === 0)!;
    const rootFolder = rows.find((row) => row.type === 'folder' && row.depth === 0)!;
    // The folder's chevron is in the column; its checkbox, after it, lines up with the file's.
    expect(rowIndent(rootFolder, levels) + LEVEL_INDENT).toBe(rowIndent(rootFile, levels));
    expect(topLevelCheckboxInset(levels)).toBe(LEVEL_INDENT);
  });

  it("starts what a folder holds a level in: its chevrons under the folder's checkbox, its checkboxes under its icon", () => {
    const rows = buildChangeRows({ ...base, changes: nested, layout: 'tree' });
    const levels = levelsOf(rows, 'tree');
    expect(rows.map((row) => [row.key, rowIndent(row, levels) / LEVEL_INDENT])).toEqual([
      ['folder:all:src', 0],
      ['change:src/b.ts', 2],
      ['folder:all:src/lib', 1],
      ['change:src/lib/c.ts', 3],
    ]);
  });

  it("starts a changelist's changes a level in from it, their checkboxes under its icon, even in a list", () => {
    const rows = buildChangeRows({ ...base, grouping: 'changelist' });
    const levels = levelsOf(rows);
    expect(rowIndent(rows[0]!, levels)).toBe(0);
    expect(rowIndent(rows[1]!, levels)).toBe(2 * LEVEL_INDENT);
    expect(topLevelCheckboxInset(levels)).toBe(LEVEL_INDENT);
  });

  it('draws one guide per changelist, status group and folder holding a row', () => {
    const rows = buildChangeRows({ ...base, changes: nested, layout: 'tree', grouping: 'changelist', groupByStatus: true });
    const levels = levelsOf(rows, 'tree');
    expect(rows.map((row) => [row.key, rowLevel(row, levels)])).toEqual([
      ['changelist:', 0],
      ['status:changelist::changed', 1],
      ['folder:status:changelist::changed:src', 2],
      ['change:src/b.ts', 3],
      ['status:changelist::added', 1],
      ['folder:status:changelist::added:src/lib', 2],
      ['change:src/lib/c.ts', 3],
    ]);
  });
});

describe('treeLevel', () => {
  it('puts folders and files under their changelist, one level per folder', () => {
    const rows = buildChangeRows({ ...base, changes: nested, layout: 'tree', grouping: 'changelist' });
    const levels = rowLevelsOf(rows, true);
    expect(rows.map((row) => [row.type, treeLevel(row, levels)])).toEqual([
      ['group', 1],
      ['folder', 2],
      ['file', 3],
      ['folder', 3],
      ['file', 4],
    ]);
  });

  it('starts at the first level without changelists', () => {
    const rows = buildChangeRows({ ...base, changes: nested, layout: 'tree' });
    expect(rows.map((row) => treeLevel(row, rowLevelsOf(rows, true)))).toEqual([1, 2, 2, 3]);
  });
});

describe('grouping by status', () => {
  const statusRows = (input: Partial<BuildInput>) =>
    buildChangeRows({ ...base, ...input }).map((row) => (row.type === 'group' ? `[${row.label}]` : row.type === 'folder' ? `${row.path}/` : row.item.path));

  it("puts the changes in a group per status, in the chips' order", () => {
    expect(statusRows({ groupByStatus: true })).toEqual(['[Changed]', 'src/a.ts', 'src/b.ts', '[Added]', 'src/lib/c.ts', '[Private]', 'new.txt']);
  });

  it("puts each changelist's changes in a group per status inside it", () => {
    expect(statusRows({ groupByStatus: true, grouping: 'changelist', changelists: [{ name: 'UI', description: '' }] })).toEqual([
      '[Default changelist]',
      '[Changed]',
      'src/b.ts',
      '[Added]',
      'src/lib/c.ts',
      '[Private]',
      'new.txt',
      '[UI]',
      '[Changed]',
      'src/a.ts',
    ]);
  });

  it("keeps an empty user changelist, holding no status group, so it still takes drops", () => {
    const rows = buildChangeRows({ ...base, groupByStatus: true, grouping: 'changelist', changelists: [{ name: 'Empty', description: '' }] });
    expect(rows.at(-1)).toMatchObject({ type: 'group', key: 'changelist:Empty', depth: 0 });
  });

  it("opens the menu of a status group's changes, not its changelist's, the default changelist's included", () => {
    const rows = buildChangeRows({ ...base, groupByStatus: true, grouping: 'changelist', changelists: [{ name: 'UI', description: '' }] });
    const pathsTargeted = (key: string): string[] | undefined => {
      const target = menuTargetOf(rows.find((row) => row.key === key)!);
      return target.kind === 'changes' ? target.changes.map((item) => item.path) : undefined;
    };
    expect(pathsTargeted('status:changelist:UI:changed')).toEqual(['src/a.ts']);
    expect(pathsTargeted('status:changelist::changed')).toEqual(['src/b.ts']);
    expect(menuTargetOf(rows.find((row) => row.key === 'changelist:')!)).toEqual({ kind: 'changelist', changelist: null });
  });

  it('closes a status group alone, leaving the same status of another changelist open', () => {
    const rows = buildChangeRows({
      ...base,
      groupByStatus: true,
      grouping: 'changelist',
      changes: [change('a.ts', ['changed']), change('b.ts', ['changed'], 'UI')],
      changelists: [{ name: 'UI', description: '' }],
      collapsed: new Set(['status:changelist::changed']),
    });
    expect(rows.map((row) => row.key)).toEqual(['changelist:', 'status:changelist::changed', 'changelist:UI', 'status:changelist:UI:changed', 'change:b.ts']);
  });
});

describe('ordering the changes', () => {
  const byStatus = fileListOrder<PendingChange>('status', { toneOf: changeTone });

  it('sorts the changes of a list, and of each folder of a tree after its folders', () => {
    const keysOf = (layout: FileListLayout) => buildChangeRows({ ...base, layout, order: byStatus }).map((row) => row.key);
    expect(keysOf('list')).toEqual(['change:src/a.ts', 'change:src/b.ts', 'change:src/lib/c.ts', 'change:new.txt']);
    expect(keysOf('tree')).toEqual(['folder:all:src', 'folder:all:src/lib', 'change:src/lib/c.ts', 'change:src/a.ts', 'change:src/b.ts', 'change:new.txt']);
  });

  it("sorts each changelist's changes", () => {
    const rows = buildChangeRows({ ...base, grouping: 'changelist', order: byStatus });
    expect(rows.map((row) => row.key)).toEqual(['changelist:', 'change:src/b.ts', 'change:src/lib/c.ts', 'change:new.txt']);
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

  const views: [string, Partial<BuildInput>][] = [
    ['sorted by name', { order: fileListOrder<PendingChange>('name', { toneOf: changeTone }) }],
    ['sorted by status', { order: fileListOrder<PendingChange>('status', { toneOf: changeTone }) }],
    ['grouped by changelist and status', { grouping: 'changelist', groupByStatus: true }],
  ];

  it.each(views)('lays out a list %s in n·log n work: twice the changes, about twice the reads', (_, view) => {
    const growth = readGrowthWhenDoubled(5_000, many, (changes) => buildChangeRows({ ...base, ...view, changes }));
    expect(growth).toBeLessThan(2.5);
  });

  // The view ranks the changes once a read (`useRankedOrder`); each key typed in the filter only picks what is left out
  // of the ranks.
  it('lays out a filtered list in a ranked order without comparing two changes', () => {
    const sorted = sortChanges(many(2_000));
    let compared = 0;
    const byName = fileListOrder<PendingChange>('name', { toneOf: changeTone })!;
    const ranked = rankedOrder(sorted, { compare: (a, b) => (compared++, byName.compare(a, b)) });
    compared = 0;
    for (const layout of ['list', 'tree'] as const) layoutChangeRows({ sorted: sorted.slice(0, 1_500), changelists: [], layout, grouping: 'none', order: ranked });
    expect(compared).toBe(0);
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
