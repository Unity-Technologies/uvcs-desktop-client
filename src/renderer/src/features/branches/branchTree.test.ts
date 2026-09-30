import { describe, expect, it } from 'vitest';
import type { Branch } from '@shared/domain/branch';
import { readGrowthWhenDoubled } from '../../testing/countedReads';
import { buildBranchTree, sortBranchesByName } from './branchTree';

function branch(name: string, parent = ''): Branch {
  return { id: 0, name, parent, comment: '', owner: '', date: '', headChangeset: 0, guid: name, repository: '' };
}

const branches = [branch('/main/task-2', '/main'), branch('/main'), branch('/main/task-1/sub', '/main/task-1'), branch('/main/task-1', '/main')];

describe('buildBranchTree', () => {
  it('nests branches under their parents, sorted by name', () => {
    const rows = buildBranchTree(sortBranchesByName(branches), new Set());
    expect(rows.map((row) => [row.branch.name, row.depth])).toEqual([
      ['/main', 0],
      ['/main/task-1', 1],
      ['/main/task-1/sub', 2],
      ['/main/task-2', 1],
    ]);
  });

  it('orders siblings as people read them, numbers by value', () => {
    const siblings = ['/main/bulk-10', '/main/Bulk-2', '/main/bulk-1'].map((name) => branch(name, '/main'));
    const rows = buildBranchTree(sortBranchesByName([branch('/main'), ...siblings]), new Set());
    expect(rows.map((row) => row.branch.name)).toEqual(['/main', '/main/bulk-1', '/main/Bulk-2', '/main/bulk-10']);
  });

  it('hides the children of collapsed branches', () => {
    const rows = buildBranchTree(sortBranchesByName(branches), new Set(['/main/task-1']));
    expect(rows.map((row) => row.branch.name)).toEqual(['/main', '/main/task-1', '/main/task-2']);
    expect(rows[1]).toMatchObject({ hasChildren: true, collapsed: true });
  });

  it('shows branches whose parent is filtered out as roots', () => {
    const rows = buildBranchTree([branch('/main/task-1/sub', '/main/task-1')], new Set());
    expect(rows).toMatchObject([{ depth: 0 }]);
  });

  it('builds the tree of 20,000 siblings', () => {
    const many = sortBranchesByName([branch('/main'), ...Array.from({ length: 20_000 }, (_, index) => branch(`/main/task-${index}`, '/main'))]);
    const rows = buildBranchTree(many, new Set());
    expect(rows).toHaveLength(20_001);
    expect(rows[2]!.branch.name).toBe('/main/task-1');
  });

  it('builds the tree in linear work, however many siblings or levels: twice the branches, twice the reads', () => {
    const siblings = (count: number) => [branch('/main'), ...Array.from({ length: count - 1 }, (_, index) => branch(`/main/task-${index}`, '/main'))];
    const chain = (count: number) => Array.from({ length: count }, (_, index) => branch(`/b${index}`, index > 0 ? `/b${index - 1}` : ''));
    expect(readGrowthWhenDoubled(1_000, siblings, (branches) => buildBranchTree(branches, new Set()))).toBeLessThan(2.05);
    expect(readGrowthWhenDoubled(500, chain, (branches) => buildBranchTree(branches, new Set()))).toBeLessThan(2.05);
  });
});
