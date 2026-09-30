import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { selectOnArrow, type SelectionState } from '../../lib/selection';
import { indexChangeRows, perRow } from './changeRowIndex';
import { rowCheckState } from './changeRowChecks';
import { layoutChangeRows, type ChangeRow } from './changeRows';

const change = (path: string, kinds: PendingChange['kinds'] = ['changed'], changelist?: string): PendingChange => ({ path, kinds, itemType: 'file', size: 1, lastModified: '', changelist });

describe('indexChangeRows', () => {
  it('finds every row by key, and keeps the files in the order shown', () => {
    const rows = layoutChangeRows({ changes: [change('src/a.ts'), change('src/b.ts', ['changed'], 'UI')], changelists: [{ name: 'UI', description: '' }], layout: 'tree', grouping: 'changelist' });

    const index = indexChangeRows(rows);

    expect(index.rowKeys).toEqual(rows.map((row) => row.key));
    expect([...index.rowIndexes].every(([key, at]) => rows[at]!.key === key)).toBe(true);
    expect(index.changeRows.map((row) => row.change.path)).toEqual(['src/a.ts', 'src/b.ts']);
    expect(index.orderedKeys).toEqual(index.changeRows.map((row) => row.key));
  });
});

describe('perRow', () => {
  it('works a row out once however often it is asked', () => {
    const asked: ChangeRow[] = [];
    const rows = layoutChangeRows({ changes: [change('a.ts'), change('b.ts')], changelists: [], layout: 'list', grouping: 'none' });
    const keyOf = perRow((row) => {
      asked.push(row);
      return row.key;
    });

    for (let pass = 0; pass < 3; pass++) rows.forEach(keyOf);

    expect(asked).toEqual(rows);
  });
});

describe('holding ↓ over 100,000 changes', () => {
  // One folder of 100,000 files: its check goes over all of them.
  const many = Array.from({ length: 100_000 }, (_, index) => change(`assets/f${String(index).padStart(6, '0')}.png`, index % 2 ? ['changed'] : ['private']));
  const rows = layoutChangeRows({ changes: many, changelists: [], layout: 'tree', grouping: 'none' });

  it('works out the check of each row that comes into view once, not on every step', () => {
    const index = indexChangeRows(rows);
    let looked = 0;
    const checkStateOf = perRow((row) => rowCheckState(row, () => (looked++, true)));
    let selection: SelectionState = { selected: new Set([index.rowKeys[0]!]), anchor: index.rowKeys[0]! };
    let focused: string | null = selection.anchor;
    const filesShown = new Set<ChangeRow>();

    // Each step renders the rows in view (about 40 around the focused one) and the folder above them.
    for (let step = 0; step < 200; step++) {
      const moved = selectOnArrow(selection, index.rowKeys, 1, false, focused)!;
      selection = moved.state;
      focused = moved.focused;
      const at = index.rowIndexes.get(focused)!;
      checkStateOf(rows[0]!);
      for (const row of rows.slice(at, at + 40)) {
        checkStateOf(row);
        if (row.type === 'change') filesShown.add(row);
      }
    }

    expect(focused).toBe(index.rowKeys[200]);
    // The folder's check went over its 100,000 changes once; each file that came into view, once more.
    expect(looked).toBe(100_000 + filesShown.size);
  });
});
