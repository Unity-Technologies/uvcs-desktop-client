import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { comparePaths, inPreviousOrder, sortForLayout } from './changeOrder';

function change(path: string, kinds: PendingChange['kinds']): PendingChange {
  return { path, kinds, itemType: 'file', size: 0, lastModified: '' };
}

describe('comparePaths', () => {
  it('puts everything in a folder right after it', () => {
    expect(['a-b.txt', 'a/c.txt', 'a', 'ab'].sort(comparePaths)).toEqual(['a', 'a/c.txt', 'a-b.txt', 'ab']);
  });

  it('orders like comparing name by name in the language order', () => {
    const collator = new Intl.Collator();
    const nameByName = (a: string, b: string): number => {
      const [namesA, namesB] = [a.split('/'), b.split('/')];
      for (let index = 0; index < Math.min(namesA.length, namesB.length); index++) {
        const order = collator.compare(namesA[index]!, namesB[index]!);
        if (order !== 0) return order;
      }
      return namesA.length - namesB.length;
    };
    const paths = ['src/b', 'Src/c', 'Src/a', 'src/a/x', 'src/B.txt', 'src', 'src-old/a', 'src/a b', 'x/file10', 'x/file2', 'x/File1', 'é/a', 'e/b', 'a/b', 'a/b/c'];
    for (const a of paths) for (const b of paths) expect(Math.sign(comparePaths(a, b)), `${a} vs ${b}`).toBe(Math.sign(nameByName(a, b)));
  });

  it('goes on past names that differ only in their Unicode form', () => {
    const composed = 'caf\u00e9';
    const decomposed = 'cafe\u0301';
    expect(comparePaths(`${composed}/b`, `${decomposed}/a`)).toBeGreaterThan(0);
    expect(comparePaths(`${composed}/a`, `${decomposed}/a`)).toBe(0);
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
    const sorted = sortForLayout(many, 'list');
    const reread = many.map((item, index) => (index % 10 ? item : { ...item, lastModified: 'later' }));
    const fresh = sortForLayout(reread, 'list');
    expect(sortForLayout(inPreviousOrder(reread, sorted), 'list')).toEqual(fresh);
  });
});
