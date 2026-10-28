import { describe, expect, it } from 'vitest';
import { countedReads, readGrowthWhenDoubled } from '@shared/testing/countedReads';
import { indexCandidates, rankCandidates } from './suggestionRanking';

interface Named {
  name: string;
  comment: string;
}

const byName = (items: readonly Named[]) => indexCandidates(items, (item) => [item.name], (item) => [item.comment]);
const names = (items: readonly Named[]) => items.map((item) => item.name);

describe('rankCandidates', () => {
  const items: Named[] = [
    { name: 'release', comment: 'Ships the main menu' },
    { name: 'main-menu', comment: '' },
    { name: 'fix-main', comment: '' },
    { name: 'Main', comment: '' },
  ];

  it('ranks the name typed, then a name starting with it, then one holding it, then a description holding it', () => {
    expect(names(rankCandidates(byName(items), 'main', 10))).toEqual(['Main', 'main-menu', 'fix-main', 'release']);
  });

  it('ignores case, and keeps the list’s order within a tier', () => {
    expect(names(rankCandidates(byName(items), 'MAI', 2))).toEqual(['main-menu', 'Main']);
  });

  it('offers the first ones when nothing is typed, and none when nothing matches', () => {
    expect(names(rankCandidates(byName(items), '', 2))).toEqual(['release', 'main-menu']);
    expect(rankCandidates(byName(items), 'zzz', 5)).toEqual([]);
  });

  it('reads each object once, into the index, and never again as typing goes on', () => {
    const { items: counted, reads } = countedReads(Array.from({ length: 1000 }, (_, index) => ({ name: `task-${index}`, comment: `Comment ${index}` })));
    const index = byName(counted);
    const indexed = reads();
    rankCandidates(index, 'task-9', 8);
    rankCandidates(index, 'comment 99', 8);
    expect(indexed).toBe(2000);
    expect(reads()).toBe(indexed);
  });

  it('grows linearly with the list', () => {
    const build = (size: number) => Array.from({ length: size }, (_, index) => ({ name: `branch-${index}`, comment: '' }));
    expect(readGrowthWhenDoubled(4000, build, (counted) => rankCandidates(byName(counted), 'zz', 8))).toBeLessThan(2.1);
  });

  it('keeps the first of many names starting with what was typed', () => {
    const index = byName(Array.from({ length: 20_000 }, (_, index) => ({ name: `branch-${index}`, comment: '' })));
    const ranked = rankCandidates(index, 'branch', 8);
    expect(names(ranked)).toEqual(['branch-0', 'branch-1', 'branch-2', 'branch-3', 'branch-4', 'branch-5', 'branch-6', 'branch-7']);
  });
});
