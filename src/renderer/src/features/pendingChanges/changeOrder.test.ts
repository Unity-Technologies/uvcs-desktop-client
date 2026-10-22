import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { sortChanges } from './changeOrder';

function change(path: string, kinds: PendingChange['kinds']): PendingChange {
  return { path, kinds, itemType: 'file', size: 0, lastModified: '' };
}

describe('sortChanges', () => {
  it('lists the changes by path, whatever their kind, as every list of files does', () => {
    const changes = [change('b/x.txt', ['private']), change('a10.txt', ['added']), change('a2.txt', ['deleted']), change('b', ['changed'])];
    expect(sortChanges(changes).map((item) => item.path)).toEqual(['a2.txt', 'a10.txt', 'b', 'b/x.txt']);
  });
});
