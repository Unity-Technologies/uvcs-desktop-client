import { describe, expect, it } from 'vitest';
import { branch, changeset, sampleHistory } from './graphFixtures';
import { layoutGraph } from './layoutGraph';

describe('layoutGraph', () => {
  it('gives every changeset its own column, in id order', () => {
    const layout = layoutGraph(sampleHistory());
    expect(layout.nodesByColumn.map((node) => node.changeset.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(layout.columnCount).toBe(8);
  });

  it('puts /main on the top row and child branches below it', () => {
    const layout = layoutGraph(sampleHistory());
    expect(layout.lanesByBranch.get('/main')?.row).toBe(0);
    expect(layout.lanesByBranch.get('/main/a')?.row).toBe(1);
  });

  it('keeps a gap between lanes sharing a row', () => {
    // /main/a spans columns 1..5 and /main/b 6..7: too close to share a row.
    expect(layoutGraph(sampleHistory()).lanesByBranch.get('/main/b')?.row).toBe(2);
  });

  it('packs branches that are far apart into the same row', () => {
    const data = sampleHistory();
    const moreMain = [8, 9, 10].map((id) => changeset(id, '/main', id === 8 ? 6 : id - 1));
    const laterB = changeset(11, '/main/b', 10);
    const layout = layoutGraph({
      ...data,
      changesets: [...data.changesets.filter((item) => item.branch !== '/main/b'), ...moreMain, laterB],
    });
    expect(layout.lanesByBranch.get('/main/b')?.row).toBe(1);
  });

  it('starts a lane at its base changeset on the parent branch', () => {
    const lane = layoutGraph(sampleHistory()).lanesByBranch.get('/main/a');
    expect(lane).toMatchObject({ startColumn: 1, endColumn: 5, baseChangeset: 1 });
  });

  it('draws an empty branch as a stub at its base', () => {
    const data = sampleHistory();
    const layout = layoutGraph({ ...data, branches: [...data.branches, branch('/main/empty', '/main', 3)] });
    expect(layout.lanesByBranch.get('/main/empty')).toMatchObject({ startColumn: 3, endColumn: 3, baseChangeset: 3 });
  });

  it('drops merge links and labels whose changesets are not loaded', () => {
    const data = sampleHistory();
    const layout = layoutGraph({ ...data, mergeLinks: [...data.mergeLinks, { type: 'merge', sourceChangeset: 99, destinationChangeset: 6 }] });
    expect(layout.mergeLinks).toHaveLength(1);
    expect(layout.labelsByChangeset.get(6)?.map((label) => label.name)).toEqual(['v1']);
  });
});
