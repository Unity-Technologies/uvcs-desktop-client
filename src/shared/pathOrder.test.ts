import { describe, expect, it } from 'vitest';
import { comparePaths } from './pathOrder';

describe('comparePaths', () => {
  it('puts everything in a folder right after it', () => {
    expect(['a-b.txt', 'a/c.txt', 'a', 'ab'].sort(comparePaths)).toEqual(['a', 'a/c.txt', 'a-b.txt', 'ab']);
  });

  it('orders numbered names as people read them', () => {
    expect(['x/file10.txt', 'x/file2.txt', 'x/File1.txt', 'x/file100.txt'].sort(comparePaths)).toEqual(['x/File1.txt', 'x/file2.txt', 'x/file10.txt', 'x/file100.txt']);
    expect(['task-10/a', 'task-2/a', 'task-2'].sort(comparePaths)).toEqual(['task-2', 'task-2/a', 'task-10/a']);
  });

  it('orders letters regardless of case first, then by case', () => {
    expect(['b', 'B/x', 'a', 'A'].sort(comparePaths)).toEqual(['a', 'A', 'b', 'B/x']);
  });

  it('orders like comparing name by name in the language order, numbers as people read them', () => {
    const collator = new Intl.Collator(undefined, { numeric: true });
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
