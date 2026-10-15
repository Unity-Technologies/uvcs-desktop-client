import { describe, expect, it } from 'vitest';
import { branchCreatedTime, newestBranchesFirst } from './newestBranchesFirst';

describe('newestBranchesFirst', () => {
  it('orders by the moment of creation, whatever offset each date was written in', () => {
    const branches = [
      { name: 'old', date: '2026-01-01T10:00:00Z' },
      { name: 'before-change', date: '2026-03-29T01:30:00+01:00' },
      { name: 'after-change', date: '2026-03-29T01:00:00+00:00' },
    ];
    expect(newestBranchesFirst(branches).map((branch) => branch.name)).toEqual(['after-change', 'before-change', 'old']);
  });

  it("puts a date it can't read last", () => {
    expect(branchCreatedTime({ date: 'not a date' })).toBe(0);
    expect(newestBranchesFirst([{ name: 'unknown', date: '' }, { name: 'known', date: '2026-01-01T10:00:00Z' }]).map((branch) => branch.name)).toEqual(['known', 'unknown']);
  });
});
