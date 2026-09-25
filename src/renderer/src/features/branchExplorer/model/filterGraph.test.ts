import { describe, expect, it } from 'vitest';
import { filterGraph } from './filterGraph';
import { sampleHistory } from './graphFixtures';

const noFilter = { relatedTo: null, hideMergedBranches: false, currentBranch: null };

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
    const filtered = filterGraph(sampleHistory(), { ...noFilter, relatedTo: '/main/b' });
    expect(filtered.branches.map((branch) => branch.name)).toEqual(['/main', '/main/b']);
  });

  it('includes branches merged into the related one', () => {
    const filtered = filterGraph(sampleHistory(), { ...noFilter, relatedTo: '/main' });
    expect(filtered.branches.map((branch) => branch.name)).toEqual(['/main', '/main/a', '/main/b']);
  });
});
