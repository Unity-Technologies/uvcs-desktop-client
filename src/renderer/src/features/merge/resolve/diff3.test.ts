import { describe, expect, it } from 'vitest';
import { countLineComparisons } from '../../../testing/countLineComparisons';
import { diff3Merge } from './diff3';

const lines = (text: string): string[] => text.split(' ').map((line) => `${line}\n`);

describe('diff3Merge', () => {
  it('takes the changes made on one side only', () => {
    expect(diff3Merge(lines('a B c d'), lines('a b c d'), lines('a b c D'))).toEqual([{ ok: lines('a B c D') }]);
  });

  it('keeps a side unchanged from the base as the other side', () => {
    const base = lines('a b c');
    expect(diff3Merge(lines('x a c'), base, base)).toEqual([{ ok: lines('x a c') }]);
    expect(diff3Merge(base, base, lines('a c y'))).toEqual([{ ok: lines('a c y') }]);
  });

  it('conflicts where both sides changed the same lines, with what each made of the base', () => {
    expect(diff3Merge(lines('a X c'), lines('a b c'), lines('a Y c'))).toEqual([
      { ok: lines('a') },
      { conflict: { a: lines('X'), o: lines('b'), b: lines('Y') } },
      { ok: lines('c') },
    ]);
  });

  it('conflicts where the changes touch, even without sharing a line', () => {
    expect(diff3Merge(lines('a X c d'), lines('a b c d'), lines('a b Y d'))).toEqual([
      { ok: lines('a') },
      { conflict: { a: lines('X c'), o: lines('b c'), b: lines('b Y') } },
      { ok: lines('d') },
    ]);
  });

  it('takes the same change made on both sides once', () => {
    expect(diff3Merge(lines('a X c'), lines('a b c'), lines('a X c'))).toEqual([{ ok: lines('a X c') }]);
  });

  it('conflicts on text added at the same place on both sides', () => {
    expect(diff3Merge(lines('a X b'), lines('a b'), lines('a Y b'))).toEqual([
      { ok: lines('a') },
      { conflict: { a: lines('X'), o: [], b: lines('Y') } },
      { ok: lines('b') },
    ]);
  });

  it('merges a 20,000-line file whose lines repeat by the thousand (a lockfile) comparing each line a few times', () => {
    const base = Array.from({ length: 20_000 }, (_, index) => (index % 3 === 0 ? '  },\n' : index % 3 === 1 ? '  "dev": true,\n' : `  "name-${index}": "1.0.${index}"\n`));
    const destination = base.map((line, index) => (index % 500 === 2 ? `  "name-${index}": "2.0.0"\n` : line));
    const source = base.map((line, index) => (index % 700 === 5 ? `  "name-${index}": "3.0.0"\n` : line));
    const { result: regions, comparisons } = countLineComparisons(() => diff3Merge(destination, base, source));
    // About 2.3 comparisons a line, by the lines changed; a pass over the file per change compares each line dozens of times.
    expect(comparisons / base.length).toBeLessThan(5);
    expect(regions.flatMap((region) => ('ok' in region ? region.ok : []))).toHaveLength(20_000);
  });
});
