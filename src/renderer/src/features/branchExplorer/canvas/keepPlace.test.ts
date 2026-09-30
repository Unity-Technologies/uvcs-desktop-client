import { describe, expect, it } from 'vitest';
import type { BranchExplorerData } from '@shared/domain/branchExplorer';
import { changeset, largeHistory, sampleHistory } from '../model/graphFixtures';
import { layoutGraph, type GraphLayout } from '../model/layoutGraph';
import { nodePoint } from './geometry';
import { keepPlace } from './keepPlace';
import { centerOn, type Viewport } from './viewport';

const screen = { width: 800, height: 600 };

function onScreen(layout: GraphLayout, id: number, viewport: Viewport): { x: number; y: number } {
  const point = nodePoint(layout, id)!;
  // Rounded past float noise: the same place on screen.
  const round = (value: number): number => Math.round(value * 1e6) / 1e6;
  return { x: round(point.x * viewport.zoom + viewport.panX), y: round(point.y * viewport.zoom + viewport.panY) };
}

/** The sample history with older changesets on a new branch: every column moves right, rows move down. */
function withOlderBranch(): BranchExplorerData {
  const history = sampleHistory();
  const older = (id: number, parent: number) => ({ ...changeset(id, '/main/old', parent), date: `2026-08-${10 + id - 20}T00:00:00Z` });
  return {
    ...history,
    branches: [...history.branches, { ...history.branches[0]!, name: '/main/old', parent: '/main', headChangeset: 21 }],
    changesets: [history.changesets[0]!, older(20, 0), older(21, 20), ...history.changesets.slice(1)],
  };
}

describe('keepPlace', () => {
  const before = layoutGraph(sampleHistory());
  const viewport: Viewport = { panX: 40, panY: 20, zoom: 0.8 };

  it('keeps the selection where it was on screen', () => {
    const after = layoutGraph(withOlderBranch());
    expect(nodePoint(after, 4)).not.toEqual(nodePoint(before, 4));
    const kept = keepPlace(before, after, viewport, screen, [{ kind: 'changeset', id: 4 }])!;
    expect(onScreen(after, 4, kept)).toEqual(onScreen(before, 4, viewport));
    expect(kept.zoom).toBe(viewport.zoom);
  });

  it('without a selection on screen, keeps the changeset nearest the middle of the screen', () => {
    const after = layoutGraph(withOlderBranch());
    const centered = centerOn(viewport, nodePoint(before, 3)!.x + 5, nodePoint(before, 3)!.y, screen);
    const kept = keepPlace(before, after, centered, screen, [{ kind: 'changeset', id: 999 }])!;
    expect(onScreen(after, 3, kept)).toEqual(onScreen(before, 3, centered));
  });

  it("puts a changeset that left the graph's nearest ancestor still in it where it was", () => {
    const history = sampleHistory();
    const withoutA = {
      ...history,
      branches: history.branches.filter((branch) => branch.name !== '/main/a'),
      changesets: history.changesets.filter((each) => each.branch !== '/main/a'),
      mergeLinks: [],
    };
    const after = layoutGraph(withoutA);
    // Only changeset 5, on /main/a, on screen: 5 → 4 → 2 → 1, on /main.
    const small = { width: 40, height: 40 };
    const onFive = centerOn({ panX: 0, panY: 0, zoom: 1 }, nodePoint(before, 5)!.x, nodePoint(before, 5)!.y, small);
    const kept = keepPlace(before, after, onFive, small, [])!;
    expect(onScreen(after, 1, kept)).toEqual(onScreen(before, 5, onFive));
  });

  it('keeps a changeset folded into a "+N" node at that node', () => {
    const data = largeHistory(400, 30);
    const full = layoutGraph(data);
    const folded = layoutGraph(data, { keep: new Set() });
    const id = full.nodesByColumn.slice(200).find((node) => folded.nodes.get(node.changeset.id)?.collapsed)!.changeset.id;
    const around = centerOn({ panX: 0, panY: 0, zoom: 1 }, nodePoint(full, id)!.x, nodePoint(full, id)!.y, screen);
    const kept = keepPlace(full, folded, around, screen, [{ kind: 'changeset', id }])!;
    expect(onScreen(folded, id, kept)).toEqual(onScreen(full, id, around));
  });

  it('has nothing to keep with nothing on screen, and stays put with the same layout', () => {
    const after = layoutGraph(withOlderBranch());
    expect(keepPlace(before, after, { panX: -100000, panY: 0, zoom: 1 }, screen, [])).toBeNull();
    expect(keepPlace(before, before, viewport, screen, [{ kind: 'changeset', id: 4 }])).toBe(viewport);
  });
});
