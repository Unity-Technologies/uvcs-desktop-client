import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import type { SelectionState } from '../../lib/selection';
import { changelistHeadersOf, changesToMove, dragFromRow } from './changelistMoves';
import { layoutChangeRows } from './changeRows';

function change(path: string, kinds: PendingChange['kinds'], changelist?: string): PendingChange {
  return { path, kinds, itemType: 'file', size: 0, lastModified: '', changelist };
}

describe('changesToMove', () => {
  const changes = [change('a.ts', ['changed']), change('b.ts', ['checkedOut'], 'UI'), change('new.ts', ['private'])];

  it('skips private files and changes already in the target', () => {
    expect(changesToMove(changes, 'UI').map((item) => item.path)).toEqual(['a.ts']);
  });

  it('moves changes back to the default changelist', () => {
    expect(changesToMove(changes, null).map((item) => item.path)).toEqual(['b.ts']);
  });
});

describe('dragFromRow', () => {
  const [edited, inList, privateFile] = [change('a.ts', ['changed']), change('b.ts', ['checkedOut'], 'UI'), change('new.ts', ['private'])];
  const row = (item: PendingChange) => ({ type: 'change' as const, key: item.path, change: item, depth: 0 });
  const selected: SelectionState = { selected: new Set(['a.ts', 'new.ts']), anchor: 'a.ts' };

  it("carries the selection's changes under version control when the row is in it", () => {
    expect(dragFromRow(row(edited), selected, () => [edited, privateFile])).toEqual({ changes: [edited] });
  });

  it('carries only a row outside the selection, and selects it', () => {
    expect(dragFromRow(row(inList), selected, () => [edited, privateFile])).toEqual({
      changes: [inList],
      select: { selected: new Set(['b.ts']), anchor: 'b.ts' },
    });
  });
});

describe('changelistHeadersOf', () => {
  const changes = [change('src/a.ts', ['changed']), change('src/ui/b.ts', ['checkedOut'], 'UI'), change('c.ts', ['changed'], 'UI')];
  const changelists = [{ name: 'UI', description: '' }];

  it("gives every row, folders and files, its changelist's header: dropping on it moves into that changelist", () => {
    const rows = layoutChangeRows({ changes, changelists, layout: 'tree', grouping: 'changelist' });
    const headers = changelistHeadersOf(rows);
    expect(rows.map((row) => [row.key, headers.get(row.key)?.key])).toEqual([
      ['changelist:', 'changelist:'],
      ['directory:changelist::src', 'changelist:'],
      ['change:src/a.ts', 'changelist:'],
      ['changelist:UI', 'changelist:UI'],
      ['change:c.ts', 'changelist:UI'],
      ['directory:changelist:UI:src/ui', 'changelist:UI'],
      ['change:src/ui/b.ts', 'changelist:UI'],
    ]);
  });

  it('has none when the changes are not grouped by changelist', () => {
    const rows = layoutChangeRows({ changes, changelists, layout: 'list', grouping: 'none' });
    expect(changelistHeadersOf(rows).size).toBe(0);
  });
});
