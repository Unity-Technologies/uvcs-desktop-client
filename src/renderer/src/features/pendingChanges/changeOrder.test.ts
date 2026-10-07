import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { inPreviousOrder, sortForLayout } from './changeOrder';

function change(path: string, kinds: PendingChange['kinds']): PendingChange {
  return { path, kinds, itemType: 'file', size: 0, lastModified: '' };
}

describe('inPreviousOrder', () => {
  const [a, b, c, d] = [change('a', ['changed']), change('b', ['changed']), change('c', ['private']), change('d', ['added'])];

  it('keeps the changes read before where they were and puts the others after them', () => {
    expect(inPreviousOrder([d, c, a], [a, b, c])).toEqual([a, c, d]);
    expect(inPreviousOrder([c, a], [a, c])).toEqual([a, c]);
  });

  it('sorts to the same order as sorting afresh', () => {
    const many = Array.from({ length: 20_000 }, (_, index) => change(`src/f${index % 50}/file${(index * 7919) % 20_000}.ts`, index % 3 ? ['changed'] : ['private']));
    const sorted = sortForLayout(many, 'list');
    const reread = many.map((item, index) => (index % 10 ? item : { ...item, lastModified: 'later' }));
    const fresh = sortForLayout(reread, 'list');
    expect(sortForLayout(inPreviousOrder(reread, sorted), 'list')).toEqual(fresh);
  });
});
