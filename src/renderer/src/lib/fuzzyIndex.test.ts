import { describe, expect, it } from 'vitest';
import { createFuzzyIndex, fuzzyMatchPositions, fuzzyMatchQuality } from './fuzzyIndex';

const paths = ['src/core/mod1.ts', 'src/ui/widgets/Button.tsx', 'docs/readme.md', 'README.md', 'src/readme-helper.ts'];

function rank(query: string, limit = 10): string[] {
  return createFuzzyIndex(paths)
    .rank(query, limit)
    .map((index) => paths[index]!);
}

describe('createFuzzyIndex', () => {
  it('keeps only fuzzy matches', () => {
    expect(rank('btn')).toEqual(['src/ui/widgets/Button.tsx']);
  });

  it('prefers file-name matches and shorter paths', () => {
    expect(rank('readme')).toEqual(['README.md', 'docs/readme.md', 'src/readme-helper.ts']);
  });

  it('prefers a run in the file name over letters scattered through the folders', () => {
    const texts = ['01plastic/src/plugins/unity/icons/iconpendingchangesview.png', '01plastic/src/gui/views/PendingChangesView.cs'];
    expect(createFuzzyIndex(texts).rank('pendingchangesview', 1)).toEqual([1]);
  });

  it('prefers the query found whole, even where its first letter shows up earlier', () => {
    const texts = ['/main/1x00874', '/main/scm1100874'];
    expect(createFuzzyIndex(texts).rank('100874', 2)).toEqual([1, 0]);
  });

  it('breaks ties with the shorter file name first', () => {
    const texts = ['a/ViewTests.cs', 'a/b/c/View.cs'];
    expect(createFuzzyIndex(texts).rank('view', 2)).toEqual([1, 0]);
  });

  it('returns at most the limit, best first', () => {
    expect(rank('readme', 2)).toEqual(['README.md', 'docs/readme.md']);
  });

  it('returns the first texts when the query is empty', () => {
    expect(rank('  ', 2)).toEqual(['src/core/mod1.ts', 'src/ui/widgets/Button.tsx']);
  });

  it('ranks each query as a fresh index would, typing on, deleting back or starting over', () => {
    const texts = Array.from({ length: 3000 }, (_, index) => `src/${['core', 'ui', 'net'][index % 3]}/part${index % 97}/file${index}.ts`);
    const typed = createFuzzyIndex(texts);
    for (const query of ['f', 'fi', 'fil', 'file1', 'file12', 'file1', 'ui', 'uip', 'u p 3', 'net/part9', 'n', 'xyz', 'xyzw', 'x']) {
      expect(typed.rank(query, 20), query).toEqual(createFuzzyIndex(texts).rank(query, 20));
    }
  });

  it('types on and deletes back through 200,000 paths looking only at what still matches', () => {
    const texts = Array.from({ length: 200_000 }, (_, index) => `assets/level${index % 50}/props/prop${index}.prefab`);
    const index = createFuzzyIndex(texts);
    for (const query of ['p', 'pr', 'pro', 'prop', 'prop1', 'prop19', 'prop199', 'prop1999']) index.rank(query, 10);
    // Each letter typed looks through the few paths left, each deleted answers from memory: all 200,000 every time
    // would take seconds.
    const start = performance.now();
    for (let digit = 0; digit < 1000; digit++) {
      expect(index.rank(`prop1999${digit % 10}`, 10).length).toBeGreaterThan(0);
      expect(index.rank('prop1999', 10)).toHaveLength(10);
    }
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

describe('fuzzyMatchPositions', () => {
  it('returns the matched indexes, preferring a run in the file name', () => {
    expect(fuzzyMatchPositions('plastic/src/PendingView.cs', 'pview')).toEqual([12, 19, 20, 21, 22]);
  });

  it('marks the query where it appears whole, digits inside a name too', () => {
    expect(fuzzyMatchPositions('/main/scm1100874', '100874')).toEqual([10, 11, 12, 13, 14, 15]);
    expect(fuzzyMatchPositions('/main/SCM1008742', 'scm1008')).toEqual([6, 7, 8, 9, 10, 11, 12]);
  });

  it('returns nothing when the text does not match', () => {
    expect(fuzzyMatchPositions('readme.md', 'xyz')).toEqual([]);
  });
});

describe('fuzzyMatchQuality', () => {
  it('ranks the whole name, its start and a run of it above scattered letters', () => {
    expect(fuzzyMatchQuality('/main/scm1002144', 'scm1002144')).toBe(1);
    expect(fuzzyMatchQuality('src/PendingChangesView.cs', 'pendingchanges')).toBe(0.9);
    expect(fuzzyMatchQuality('src/MyPendingView.cs', 'pending')).toBe(0.8);
    expect(fuzzyMatchQuality('lib/org.eclipse.core.commands_3.6.100.v20140', 'scm1002144')).toBeLessThan(0.3);
  });

  it('is zero when nothing matches', () => {
    expect(fuzzyMatchQuality('readme.md', 'xyz')).toBe(0);
  });
});
