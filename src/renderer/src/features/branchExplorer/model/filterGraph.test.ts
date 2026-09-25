import { describe, expect, it } from 'vitest';
import type { BranchExplorerData } from '@shared/domain/branchExplorer';
import { filterGraph, relatedBranches } from './filterGraph';
import { branch, changeset, merge, sampleHistory } from './graphFixtures';

const noFilter = { focus: null, visibleBranches: null, hideMergedBranches: false, currentBranch: null };

describe('filterGraph', () => {
  it('keeps everything without filters', () => {
    expect(filterGraph(sampleHistory(), noFilter).branches).toHaveLength(3);
  });

  it('hides branches whose last changeset was merged', () => {
    const filtered = filterGraph(sampleHistory(), { ...noFilter, hideMergedBranches: true });
    expect(filtered.branches.map((branch) => branch.name)).toEqual(['/main', '/main/b']);
    expect(filtered.changesets.some((changeset) => changeset.branch === '/main/a')).toBe(false);
    expect(filtered.mergeLinks).toEqual([]);
  });

  it('never hides the workspace branch', () => {
    const filtered = filterGraph(sampleHistory(), { ...noFilter, hideMergedBranches: true, currentBranch: '/main/a' });
    expect(filtered.branches.map((branch) => branch.name)).toContain('/main/a');
  });

  it('shows only the branches related to one', () => {
    const filtered = filterGraph(sampleHistory(), { ...noFilter, focus: { branch: '/main/b', hops: 1 } });
    expect(filtered.branches.map((branch) => branch.name)).toEqual(['/main', '/main/b']);
  });

  it('includes branches merged into the related one', () => {
    const filtered = filterGraph(sampleHistory(), { ...noFilter, focus: { branch: '/main', hops: 1 } });
    expect(filtered.branches.map((branch) => branch.name)).toEqual(['/main', '/main/a', '/main/b']);
  });

  it('shows only the chosen branches', () => {
    const filtered = filterGraph(sampleHistory(), { ...noFilter, visibleBranches: new Set(['/main', '/main/a']) });
    expect(filtered.branches.map((branch) => branch.name)).toEqual(['/main', '/main/a']);
    expect(filtered.changesets.some((changeset) => changeset.branch === '/main/b')).toBe(false);
  });
});

/**
 * /main ─ /main/task ─ /main/task/fix     (/main/task/fix merged into /main/other)
 *       └ /main/other ─ /main/other/sub
 */
function family(): BranchExplorerData {
  return {
    branches: [
      branch('/main'),
      branch('/main/task', '/main'),
      branch('/main/task/fix', '/main/task'),
      branch('/main/other', '/main'),
      branch('/main/other/sub', '/main/other'),
    ],
    changesets: [
      changeset(0, '/main', -1),
      changeset(1, '/main/task', 0),
      changeset(2, '/main/task/fix', 1),
      changeset(3, '/main/other', 0),
      changeset(4, '/main/other', 3),
      changeset(5, '/main/other/sub', 4),
    ],
    mergeLinks: [merge(2, 4)],
    labels: [],
  };
}

describe('relatedBranches', () => {
  const sorted = (names: Set<string>): string[] => [...names].sort();

  it('one hop reaches the parent, the children and merge partners', () => {
    expect(sorted(relatedBranches(family(), '/main/task/fix', 1))).toEqual(['/main', '/main/other', '/main/task', '/main/task/fix']);
  });

  it('each hop adds the relatives of the previous ones', () => {
    expect(sorted(relatedBranches(family(), '/main/task/fix', 2))).toEqual([
      '/main',
      '/main/other',
      '/main/other/sub',
      '/main/task',
      '/main/task/fix',
    ]);
  });

  it('always keeps the ancestors, however far', () => {
    expect(sorted(relatedBranches(family(), '/main/other/sub', 1))).toEqual(['/main', '/main/other', '/main/other/sub']);
  });

  it('includes an unknown branch only as itself', () => {
    expect(sorted(relatedBranches(family(), '/gone', 3))).toEqual(['/gone']);
  });
});
