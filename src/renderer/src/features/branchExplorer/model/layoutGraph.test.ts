import { describe, expect, it } from 'vitest';
import type { PendingMergeLink } from '@shared/domain/pendingChanges';
import { branch, changeset, largeHistory, sampleHistory } from './graphFixtures';
import { layoutGraph, layoutKeeping } from './layoutGraph';

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

describe('layoutGraph rows', () => {
  /** /main/a/fix branches from 4 on /main/a, and has 8 and 9. */
  function withGrandchild() {
    const data = sampleHistory();
    return {
      ...data,
      branches: [...data.branches, branch('/main/a/fix', '/main/a', 9)],
      changesets: [...data.changesets, changeset(8, '/main/a/fix', 4), changeset(9, '/main/a/fix', 8)],
    };
  }

  it('puts a child branch below its parent, however much room rows above have', () => {
    const layout = layoutGraph(withGrandchild());
    expect(layout.lanesByBranch.get('/main/a/fix')!.row).toBeGreaterThan(layout.lanesByBranch.get('/main/a')!.row);
  });

  it('still draws a branch whose parent branch is not in the graph (hidden or filtered out), below /main', () => {
    const data = withGrandchild();
    const withoutParent = { ...data, branches: data.branches.filter((each) => each.name !== '/main/a'), changesets: data.changesets.filter((each) => each.branch !== '/main/a'), mergeLinks: [] };
    const lane = layoutGraph(withoutParent).lanesByBranch.get('/main/a/fix');
    expect(lane).toMatchObject({ startColumn: 5, endColumn: 6, baseChangeset: null });
    expect(lane!.row).toBeGreaterThan(0);
  });

  it('gives /main the top row even when another top-level branch starts before it', () => {
    const layout = layoutGraph({
      branches: [branch('/legacy', '', 1), branch('/main', '', 3)],
      changesets: [changeset(0, '/legacy', -1), changeset(1, '/legacy', 0), changeset(2, '/main', -1), changeset(3, '/main', 2)],
      mergeLinks: [],
      labels: [],
    });
    expect(layout.lanesByBranch.get('/main')!.row).toBe(0);
    expect(layout.lanesByBranch.get('/legacy')!.row).toBe(1);
  });

  it('draws nothing for a branch with no changesets and no base in the graph', () => {
    const data = sampleHistory();
    expect(layoutGraph({ ...data, branches: [...data.branches, branch('/main/old', '/main', 99)] }).lanesByBranch.has('/main/old')).toBe(false);
  });

  it('counts the rows the lanes take', () => {
    expect(layoutGraph(sampleHistory()).rowCount).toBe(3);
    expect(layoutGraph({ branches: [], changesets: [], mergeLinks: [], labels: [] })).toMatchObject({ rowCount: 0, columnCount: 0, pending: null });
  });
});

describe('layoutKeeping', () => {
  it('lays out exactly what keeping one more changeset lays out, reusing the layout when it already shows on its own', () => {
    const data = largeHistory(3_000, 600);
    const keep = new Set([40, 41]);
    const base = { keep, pending: null, layout: layoutGraph(data, { keep }) };
    let reused = 0;
    for (let id = 0; id < 3_000; id += 7) {
      const layout = layoutKeeping(data, base, id);
      if (layout === base.layout) reused++;
      expect(layout.nodesByColumn).toEqual(layoutGraph(data, { keep: new Set([...keep, id]) }).nodesByColumn);
    }
    expect(reused).toBeGreaterThan(0);
    expect(layoutKeeping(data, base, null)).toBe(base.layout);
    // 430 whole layouts to compare against: about a second here, several on a slower machine running the suite.
  }, 30_000);
});

describe('layoutGraph with pending changes', () => {
  const pending = (branch: string, parent: number, mergeLinks: PendingMergeLink[] = []) => ({ branch, parent, mergeLinks });

  it('puts the pending changeset past every changeset, on its branch, the band reaching it', () => {
    const layout = layoutGraph(sampleHistory(), undefined, pending('/main/a', 5));
    expect(layout.pending).toMatchObject({ column: 8, row: 1, parent: 5 });
    expect(layout.columnCount).toBe(8);
    expect(layout.lanesByBranch.get('/main/a')).toMatchObject({ endColumn: 8, firstOwnColumn: 2 });
  });

  it('hangs it off the loaded changeset when the branch went on without the workspace', () => {
    expect(layoutGraph(sampleHistory(), undefined, pending('/main/a', 4)).pending).toMatchObject({ column: 8, parent: 4 });
  });

  it('starts the band of a branch without changesets there', () => {
    const data = sampleHistory();
    const layout = layoutGraph({ ...data, branches: [...data.branches, branch('/main/new', '/main', 6)] }, undefined, pending('/main/new', 6));
    expect(layout.lanesByBranch.get('/main/new')).toMatchObject({ startColumn: 6, endColumn: 8, firstOwnColumn: 8, baseChangeset: 6 });
  });

  it('takes its room in the row before the rows are packed', () => {
    const data = sampleHistory();
    const moreMain = [8, 9, 10].map((id) => changeset(id, '/main', id === 8 ? 6 : id - 1));
    const history = { ...data, changesets: [...data.changesets.filter((item) => item.branch !== '/main/b'), ...moreMain, changeset(11, '/main/b', 10)] };
    expect(layoutGraph(history).lanesByBranch.get('/main/b')?.row).toBe(1);
    expect(layoutGraph(history, undefined, pending('/main/a', 5)).lanesByBranch.get('/main/b')?.row).toBe(2);
  });

  it('keeps the merge links from changesets in the graph', () => {
    const links: PendingMergeLink[] = [
      { type: 'merge', sourceChangeset: 7 },
      { type: 'cherryPick', sourceChangeset: 99 },
    ];
    expect(layoutGraph(sampleHistory(), undefined, pending('/main', 6, links)).pending?.mergeLinks).toEqual([links[0]]);
  });

  it('draws none when the loaded changeset or its branch is out of the graph', () => {
    expect(layoutGraph(sampleHistory(), undefined, pending('/main/a', 99)).pending).toBeNull();
    expect(layoutGraph(sampleHistory(), undefined, pending('/main/gone', 5)).pending).toBeNull();
    expect(layoutGraph(sampleHistory()).pending).toBeNull();
  });

  it('keeps it while "Only relevant changesets" keeps the selection', () => {
    const data = sampleHistory();
    const base = { keep: new Set([5]), pending: pending('/main/a', 5), layout: layoutGraph(data, { keep: new Set([5]) }, pending('/main/a', 5)) };
    expect(layoutKeeping(data, base, 4).pending).toMatchObject({ parent: 5, row: 1 });
  });
});

describe('layoutGraph at scale', () => {
  it('lays out a branch with more changesets than a function takes arguments', () => {
    const changesets = Array.from({ length: 200_000 }, (_, id) => changeset(id, '/main', id - 1));
    const lane = layoutGraph({ branches: [branch('/main', '', 199_999)], changesets, mergeLinks: [], labels: [] }).lanesByBranch.get('/main');
    expect(lane).toMatchObject({ startColumn: 0, endColumn: 199_999, firstOwnColumn: 0 });
  });

  it('places 20,000 branches of 100,000 changesets well within a second, never closer than the gap', () => {
    const data = largeHistory(100_000, 20_000);
    const started = performance.now();
    const layout = layoutGraph(data);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(layout.lanes).toHaveLength(20_000);
    for (const lanes of layout.lanesByRow.values()) {
      const sorted = [...lanes].sort((a, b) => a.startColumn - b.startColumn);
      sorted.slice(1).forEach((lane, index) => expect(lane.startColumn - sorted[index]!.endColumn).toBeGreaterThan(3));
    }
  });
});
