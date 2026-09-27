import { describe, expect, it } from 'vitest';
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

describe('layoutKeeping', () => {
  it('lays out exactly what keeping one more changeset lays out, reusing the layout when it already shows on its own', () => {
    const data = largeHistory(3_000, 600);
    const keep = new Set([40, 41]);
    const base = { keep, layout: layoutGraph(data, { keep }) };
    let reused = 0;
    for (let id = 0; id < 3_000; id += 7) {
      const layout = layoutKeeping(data, base, id);
      if (layout === base.layout) reused++;
      expect(layout.nodesByColumn).toEqual(layoutGraph(data, { keep: new Set([...keep, id]) }).nodesByColumn);
    }
    expect(reused).toBeGreaterThan(0);
    expect(layoutKeeping(data, base, null)).toBe(base.layout);
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
