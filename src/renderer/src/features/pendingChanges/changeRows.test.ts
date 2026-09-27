import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { treeArrowMove } from '../../lib/treeArrowMove';
import { changesUnderRow, changeTreeArrowRows, collapseRows, comparePaths, inPreviousOrder, layoutChangeRows, LEVEL_INDENT, menuTargetOf, rowCheckState, rowIndent, sortForLayout, topLevelCheckboxInset, treeLevel, type ChangeRow, type ChangesGrouping, type ChangesLayout } from './changeRows';

/** The rows the list shows. */
function buildChangeRows({ collapsed, ...layout }: Parameters<typeof layoutChangeRows>[0] & { collapsed: ReadonlySet<string> }): ChangeRow[] {
  return collapseRows(layoutChangeRows(layout), collapsed);
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
  layout: 'list' as ChangesLayout,
  grouping: 'none' as ChangesGrouping,
  collapsed: new Set<string>(),
};

describe('buildChangeRows', () => {
  it('lists every change without a header, by status in filter order and then by path', () => {
    const rows = buildChangeRows(base);
    expect(rows.map((row) => row.key)).toEqual(['change:src/a.ts', 'change:src/b.ts', 'change:src/lib/c.ts', 'change:new.txt']);
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
    const rows = buildChangeRows({ ...base, changes: [change('privs/a.txt', ['private']), folder, change('private.txt', ['private'])], layout: 'tree' });
    expect(rows.map((row) => row.key)).toEqual(['change:private.txt', 'directory:all:privs', 'change:privs/a.txt']);
    expect(rows[1]).toMatchObject({ change: folder });
    expect(rowCheckState(rows[1]!, (item) => item !== folder)).toBe('mixed');
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
    expect(rows.filter((row) => row.type === 'directory').map((row) => [row.path, row.type === 'directory' && rowCheckState(row, () => true)])).toEqual([
      ['bin', null],
      ['src', true],
    ]);
    const files = rows.filter((row) => row.type === 'change');
    expect(files.map((row) => rowCheckState(row, (item) => item.path !== 'src/a.ts'))).toEqual([null, false, null]);
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

  it('leaves out what collapsed changelists and folders hold, and nothing after them', () => {
    const layout = layoutChangeRows({ ...base, changes, layout: 'tree', grouping: 'changelist', changelists: [{ name: 'UI', description: '' }] });
    expect(layout.map((row) => row.key)).toEqual([
      'changelist:',
      'change:new.txt',
      'directory:changelist::src',
      'change:src/b.ts',
      'directory:changelist::src/lib',
      'change:src/lib/c.ts',
      'changelist:UI',
      'directory:changelist:UI:src',
      'change:src/a.ts',
    ]);
    const shown = collapseRows(layout, new Set(['directory:changelist::src', 'directory:changelist::src/lib', 'changelist:UI']));
    expect(shown.map((row) => [row.key, row.type !== 'change' && row.collapsed])).toEqual([
      ['changelist:', false],
      ['change:new.txt', false],
      ['directory:changelist::src', true],
      ['changelist:UI', true],
    ]);
    expect(collapseRows(layout, new Set())).toBe(layout);
  });
});

describe('changeTreeArrowRows', () => {
  it('lets ← and → close and open changelists and folders, and step between them and their files', () => {
    const rows = buildChangeRows({ ...base, changes: nested, layout: 'tree', grouping: 'changelist', collapsed: new Set(['directory:changelist::src/lib']) });
    const arrowRows = changeTreeArrowRows(rows);
    const at = (key: string) => rows.findIndex((row) => row.key === key);
    expect(rows.map((row) => row.key)).toEqual(['changelist:', 'directory:changelist::src', 'change:src/b.ts', 'directory:changelist::src/lib']);
    expect(treeArrowMove(arrowRows, at('directory:changelist::src/lib'), 'ArrowRight')).toEqual({ kind: 'toggle' });
    expect(treeArrowMove(arrowRows, at('directory:changelist::src'), 'ArrowLeft')).toEqual({ kind: 'toggle' });
    expect(treeArrowMove(arrowRows, at('change:src/b.ts'), 'ArrowLeft')).toEqual({ kind: 'moveBy', step: -1 });
    expect(treeArrowMove(arrowRows, at('directory:changelist::src'), 'ArrowRight')).toEqual({ kind: 'moveBy', step: 1 });
    expect(treeArrowMove(arrowRows, at('directory:changelist::src/lib'), 'ArrowLeft')).toEqual({ kind: 'moveBy', step: -2 });
  });
});

describe('comparePaths', () => {
  it('puts everything in a folder right after it', () => {
    expect(['a-b.txt', 'a/c.txt', 'a', 'ab'].sort(comparePaths)).toEqual(['a', 'a/c.txt', 'a-b.txt', 'ab']);
  });

  it('orders like comparing name by name in the language order', () => {
    const collator = new Intl.Collator();
    const nameByName = (a: string, b: string): number => {
      const [namesA, namesB] = [a.split('/'), b.split('/')];
      for (let index = 0; index < Math.min(namesA.length, namesB.length); index++) {
        const order = collator.compare(namesA[index]!, namesB[index]!);
        if (order !== 0) return order;
      }
      return namesA.length - namesB.length;
    };
    const paths = ['src/b', 'Src/c', 'Src/a', 'src/a/x', 'src/B.txt', 'src', 'src-old/a', 'src/a b', 'x/file10', 'x/file2', 'x/File1', 'é/a', 'e/b', 'a/b', 'a/b/c'];
    for (const a of paths) for (const b of paths) expect(Math.sign(comparePaths(a, b)), `${a} vs ${b}`).toBe(Math.sign(nameByName(a, b)));
  });

  it('goes on past names that differ only in their Unicode form', () => {
    const composed = 'caf\u00e9';
    const decomposed = 'cafe\u0301';
    expect(comparePaths(`${composed}/b`, `${decomposed}/a`)).toBeGreaterThan(0);
    expect(comparePaths(`${composed}/a`, `${decomposed}/a`)).toBe(0);
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

describe('buildChangeRows at scale', () => {
  // 100,000 changes, deep and flat: 20 × 10 × 5 folders of 50 files, and one folder of 50,000.
  const many = Array.from({ length: 100_000 }, (_, index) =>
    index % 2
      ? change(`src/m${index % 20}/p${index % 10}/s${index % 5}/f${index}.cs`, index % 3 ? ['changed'] : ['checkedOut', 'changed'])
      : change(`flat/asset${index}.txt`, index % 4 ? ['private'] : ['added']),
  );
  const timed = (layout: ChangesLayout, grouping: ChangesGrouping): number => {
    const started = performance.now();
    buildChangeRows({ ...base, changes: many, layout, grouping });
    return performance.now() - started;
  };

  it('lays out a list, a tree and changelists of 100,000 changes in well under a second each', () => {
    expect(timed('list', 'none')).toBeLessThan(1000);
    expect(timed('tree', 'none')).toBeLessThan(1000);
    expect(timed('tree', 'changelist')).toBeLessThan(1000);
  });
});

describe('inPreviousOrder', () => {
  const [a, b, c, d] = [change('a', ['changed']), change('b', ['changed']), change('c', ['private']), change('d', ['added'])];

  it('keeps the changes read before where they were and puts the others after them', () => {
    expect(inPreviousOrder([d, c, a], [a, b, c])).toEqual([a, c, d]);
    expect(inPreviousOrder([c, a], [a, c])).toEqual([a, c]);
  });

  it('sorts to the same order as sorting afresh', () => {
    const many = Array.from({ length: 20_000 }, (_, index) => change(`src/f${index % 50}/file${(index * 7919) % 20_000}.ts`, index % 3 ? ['changed'] : ['private']));
    const sorted = sortForLayout(many, 'list');
    const reread = many.map((item, index) => (index % 10 ? item : { ...item, lastModified: 'later' }));
    const fresh = sortForLayout(reread, 'list');
    expect(sortForLayout(inPreviousOrder(reread, sorted), 'list')).toEqual(fresh);
  });
});
