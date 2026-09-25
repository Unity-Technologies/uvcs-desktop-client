import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { buildChangeRows } from './changeRows';

function change(path: string, kinds: PendingChange['kinds']): PendingChange {
  return { path, kinds, itemType: 'file', size: 0, lastModified: '' };
}

const changes = [change('src/b.ts', ['changed']), change('src/a.ts', ['checkedOut', 'changed']), change('new.txt', ['private']), change('src/lib/c.ts', ['added'])];

describe('buildChangeRows', () => {
  it('groups changes by category in a stable order', () => {
    const rows = buildChangeRows({ changes, layout: 'list', isChecked: () => true, collapsed: new Set() });
    expect(rows.map((row) => row.key)).toEqual([
      'category:changed',
      'change:src/a.ts',
      'change:src/b.ts',
      'category:added',
      'change:src/lib/c.ts',
      'category:private',
      'change:new.txt',
    ]);
  });

  it('reports a mixed check state when only some changes are checked', () => {
    const rows = buildChangeRows({ changes, layout: 'list', isChecked: (item) => item.path === 'src/a.ts', collapsed: new Set() });
    expect(rows[0]).toMatchObject({ type: 'category', checkState: 'mixed' });
  });

  it('nests changes under their folders in tree layout', () => {
    const rows = buildChangeRows({ changes: [changes[3]!], layout: 'tree', isChecked: () => true, collapsed: new Set() });
    expect(rows.map((row) => [row.type, row.type === 'change' ? row.depth : row.type === 'directory' ? row.depth : -1])).toEqual([
      ['category', -1],
      ['directory', 0],
      ['directory', 1],
      ['change', 2],
    ]);
  });

  it('hides the contents of collapsed folders', () => {
    const rows = buildChangeRows({
      changes: [change('src/a.ts', ['changed']), change('src/b.ts', ['changed']), change('z.ts', ['changed'])],
      layout: 'tree',
      isChecked: () => true,
      collapsed: new Set(['directory:changed:src']),
    });
    expect(rows.map((row) => row.key)).toEqual(['category:changed', 'directory:changed:src', 'change:z.ts']);
  });
});
