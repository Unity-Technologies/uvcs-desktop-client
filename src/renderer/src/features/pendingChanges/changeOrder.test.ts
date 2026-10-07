import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { inPreviousOrder, sortChanges } from './changeOrder';

function change(path: string, kinds: PendingChange['kinds']): PendingChange {
  return { path, kinds, itemType: 'file', size: 0, lastModified: '' };
}

describe('sortChanges', () => {
  it('lists the changes by path, whatever their kind, as every list of files does', () => {
    const changes = [change('b/x.txt', ['private']), change('a10.txt', ['added']), change('a2.txt', ['deleted']), change('b', ['changed'])];
    expect(sortChanges(changes).map((item) => item.path)).toEqual(['a2.txt', 'a10.txt', 'b', 'b/x.txt']);
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
    const sorted = sortChanges(many);
    const reread = many.map((item, index) => (index % 10 ? item : { ...item, lastModified: 'later' }));
    const fresh = sortChanges(reread);
    expect(sortChanges(inPreviousOrder(reread, sorted))).toEqual(fresh);
  });
});
