import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { buildChangeRows, type ChangesGrouping, type ChangesLayout } from './changeRows';

function change(path: string, kinds: PendingChange['kinds'], changelist?: string): PendingChange {
  return { path, kinds, itemType: 'file', size: 0, lastModified: '', changelist };
}

const changes = [change('src/b.ts', ['changed']), change('src/a.ts', ['checkedOut', 'changed'], 'UI'), change('new.txt', ['private']), change('src/lib/c.ts', ['added'])];
const base = {
  changes,
  changelists: [],
  layout: 'list' as ChangesLayout,
  grouping: 'status' as ChangesGrouping,
  isChecked: () => true,
  collapsed: new Set<string>(),
};

describe('buildChangeRows', () => {
  it('groups changes by status in a stable order', () => {
    const rows = buildChangeRows(base);
    expect(rows.map((row) => row.key)).toEqual([
      'status:changed',
      'change:src/a.ts',
      'change:src/b.ts',
      'status:added',
      'change:src/lib/c.ts',
      'status:private',
      'change:new.txt',
    ]);
  });

  it('reports a mixed check state when only some changes are checked', () => {
    const rows = buildChangeRows({ ...base, isChecked: (item) => item.path === 'src/a.ts' });
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
      ['group', -1],
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
      collapsed: new Set(['directory:status:changed:src']),
    });
    expect(rows.map((row) => row.key)).toEqual(['status:changed', 'directory:status:changed:src', 'change:z.ts']);
  });
});
