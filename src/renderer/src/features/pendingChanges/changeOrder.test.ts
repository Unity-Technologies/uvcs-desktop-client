import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { countCalls } from '@shared/testing/countCalls';
import { sortChanges, sortedFromPrevious } from './changeOrder';

function change(path: string, kinds: PendingChange['kinds']): PendingChange {
  return { path, kinds, itemType: 'file', size: 0, lastModified: '' };
}

describe('sortChanges', () => {
  it('lists the changes by path, whatever their kind, as every list of files does', () => {
    const changes = [change('b/x.txt', ['private']), change('a10.txt', ['added']), change('a2.txt', ['deleted']), change('b', ['changed'])];
    expect(sortChanges(changes).map((item) => item.path)).toEqual(['a2.txt', 'a10.txt', 'b', 'b/x.txt']);
  });
});

describe('sortedFromPrevious', () => {
  const many = Array.from({ length: 5_000 }, (_, index) => change(`src/f${index % 50}/file${(index * 7919) % 5_000}.ts`, index % 3 ? ['changed'] : ['private']));
  const sorted = sortChanges(many);

  it('sorts to the same order as sorting afresh, whatever order the read came in', () => {
    const reread = [...many].reverse().map((item, index) => (index % 10 ? item : { ...item, lastModified: 'later' }));
    reread.push(change('src/f0/new.ts', ['private']));
    expect(sortedFromPrevious(reread, sorted)).toEqual(sortChanges(reread));
    expect(sortedFromPrevious([...many].reverse(), sorted)).toEqual(sorted);
  });

  it('sorts only the changes a refresh brings, and merges them in', () => {
    const reread = [...many];
    reread[10] = { ...reread[10]!, lastModified: 'later' };
    // `sortByPath` sorts each folder's names apart: sorting all again sorts the 50 folders' and more.
    const { result, calls } = countCalls(Array.prototype, 'sort', () => sortedFromPrevious(reread, sorted));
    expect(result).toEqual(sortChanges(reread));
    expect(calls).toBeLessThan(5);
    expect(countCalls(Array.prototype, 'sort', () => sortChanges(reread)).calls).toBeGreaterThan(50);
  });
});
