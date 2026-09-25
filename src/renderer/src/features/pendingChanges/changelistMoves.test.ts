import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { changesToMove } from './changelistMoves';

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
