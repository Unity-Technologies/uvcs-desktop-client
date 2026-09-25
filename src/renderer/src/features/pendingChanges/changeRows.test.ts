import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { buildChangeRows, LEVEL_INDENT, rowIndent, topLevelCheckboxInset, treeLevel, type ChangesGrouping, type ChangesLayout } from './changeRows';

function change(path: string, kinds: PendingChange['kinds'], changelist?: string): PendingChange {
  return { path, kinds, itemType: 'file', size: 0, lastModified: '', changelist };
}

const changes = [change('src/b.ts', ['changed']), change('src/a.ts', ['checkedOut', 'changed'], 'UI'), change('new.txt', ['private']), change('src/lib/c.ts', ['added'])];
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
    const rows = buildChangeRows({ ...base, changes: [changes[3]!], layout: 'tree' });
    expect(rows.map((row) => [row.type, row.type === 'group' ? -1 : row.depth])).toEqual([
      ['directory', 0],
      ['directory', 1],
      ['change', 2],
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
    const rows = buildChangeRows({ ...base, changes: [changes[3]!], layout: 'tree' });
    expect(rows.map((row) => rowIndent(row, false))).toEqual([0, LEVEL_INDENT, 2 * LEVEL_INDENT]);
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
    const rows = buildChangeRows({ ...base, changes: [changes[3]!], layout: 'tree', grouping: 'changelist' });
    expect(rows.map((row) => [row.type, treeLevel(row, true)])).toEqual([
      ['group', 1],
      ['directory', 2],
      ['directory', 3],
      ['change', 4],
    ]);
  });

  it('starts at the first level without changelists', () => {
    const rows = buildChangeRows({ ...base, changes: [changes[3]!], layout: 'tree' });
    expect(rows.map((row) => treeLevel(row, false))).toEqual([1, 2, 3]);
  });
});
