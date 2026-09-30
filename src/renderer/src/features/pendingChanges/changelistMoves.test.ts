import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import type { SelectionState } from '../../lib/selection';
import { changesToMove, dragFromRow } from './changelistMoves';

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
