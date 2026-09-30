import { describe, expect, it } from 'vitest';
import type { BranchExplorerData } from '@shared/domain/branchExplorer';
import { branch, changeset, sampleHistory } from '../model/graphFixtures';
import { layoutGraph, type GraphLayout } from '../model/layoutGraph';
import { nodePoint, pendingPoint } from './geometry';
import { graphExtent } from './laneShape';
import { preferredPlaces, viewportAfterLayout } from './placeAfterLayout';
import { centerOn, type Viewport } from './viewport';

const screen = { width: 800, height: 600 };
const nothingSelected = { selectedChangeset: null, selectedBranch: null, selectedPending: false, homeChangeset: null };

/** New history arrived: older changesets on a new branch push every column right and every row down. */
function withOlderBranch(): BranchExplorerData {
  const history = sampleHistory();
  return {
    ...history,
    branches: [...history.branches, branch('/main/old', '/main', 21)],
    changesets: [history.changesets[0]!, changeset(20, '/main/old', 0), changeset(21, '/main/old', 20), ...history.changesets.slice(1)],
  };
}

/** Where a world point shows on screen, past float noise. */
function screenPoint(point: { x: number; y: number }, viewport: Viewport): { x: number; y: number } {
  const round = (value: number): number => Math.round(value * 1e6) / 1e6;
  return { x: round(point.x * viewport.zoom + viewport.panX), y: round(point.y * viewport.zoom + viewport.panY) };
}

const before = layoutGraph(sampleHistory(), undefined, { branch: '/main/a', parent: 5, mergeLinks: [] });
const after = layoutGraph(withOlderBranch(), undefined, { branch: '/main/a', parent: 5, mergeLinks: [] });
/** The whole sample history on screen, at a zoom that shows it all. */
const wholeGraph: Viewport = { panX: 0, panY: 0, zoom: 1 };

function stays(id: number | 'pending', from: GraphLayout, to: GraphLayout, viewport: Viewport, kept: Viewport): boolean {
  const point = (layout: GraphLayout) => (id === 'pending' ? pendingPoint(layout)! : nodePoint(layout, id)!);
  return JSON.stringify(screenPoint(point(from), viewport)) === JSON.stringify(screenPoint(point(to), kept));
}

describe('the place kept when the graph is laid out again', () => {
  it('prefers the selection, then the home badge on the pending changes, then the loaded changeset', () => {
    expect(preferredPlaces({ selectedChangeset: 4, selectedBranch: null, selectedPending: false, homeChangeset: 5 }, before)).toEqual([
      { kind: 'changeset', id: 4 },
      { kind: 'pending' },
      { kind: 'changeset', id: 5 },
    ]);
    expect(preferredPlaces({ ...nothingSelected, selectedBranch: '/main/b', homeChangeset: 5 }, layoutGraph(sampleHistory()))).toEqual([
      { kind: 'branch', name: '/main/b' },
      { kind: 'changeset', id: 5 },
    ]);
    expect(preferredPlaces({ ...nothingSelected, selectedPending: true }, before)[0]).toEqual({ kind: 'pending' });
  });

  it('holds the selected changeset where it was on screen', () => {
    const kept = viewportAfterLayout(before, after, wholeGraph, screen, { ...nothingSelected, selectedChangeset: 3, homeChangeset: 5 });
    expect(stays(3, before, after, wholeGraph, kept)).toBe(true);
  });

  it('holds the home badge on the pending changes while nothing is selected', () => {
    const kept = viewportAfterLayout(before, after, wholeGraph, screen, { ...nothingSelected, homeChangeset: 5 });
    expect(stays('pending', before, after, wholeGraph, kept)).toBe(true);
  });

  it('holds the home badge instead of a selection scrolled off screen', () => {
    const onHome = centerOn(wholeGraph, nodePoint(before, 5)!.x, nodePoint(before, 5)!.y, { width: 120, height: 120 });
    const small = { width: 120, height: 120 };
    const kept = viewportAfterLayout(before, after, onHome, small, { ...nothingSelected, selectedChangeset: 0, homeChangeset: 5 });
    expect(stays(5, before, after, onHome, kept)).toBe(true);
  });

  it('goes to the newest end with nothing on screen to hold on to', () => {
    const faraway: Viewport = { panX: -100_000, panY: 0, zoom: 1 };
    const kept = viewportAfterLayout(before, after, faraway, screen, nothingSelected);
    expect(kept.panX + graphExtent(after).width).toBe(screen.width);
  });
});
