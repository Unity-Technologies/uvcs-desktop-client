import { describe, expect, it } from 'vitest';
import { largeHistory, sampleHistory } from '../model/graphFixtures';
import { layoutGraph } from '../model/layoutGraph';
import { nodePoint, pendingPoint } from './geometry';
import { graphExtent } from './laneShape';
import { awayFromNewest, newestEnd } from './newestEnd';

const layout = layoutGraph(largeHistory(400, 30));
const screen = { width: 800, height: 600 };
const newest = nodePoint(layout, layout.nodesByColumn.at(-1)!.changeset.id)!;

describe('newestEnd', () => {
  it("puts the graph's end at the right of the screen, at the same zoom", () => {
    const end = newestEnd(layout, { panX: 0, panY: 0, zoom: 0.5 }, screen);
    expect(end.zoom).toBe(0.5);
    expect(end.panX + graphExtent(layout).width * 0.5).toBe(screen.width);
    expect(awayFromNewest(layout, end, screen)).toBe(false);
  });

  it("brings the newest changeset's row into view only when it isn't", () => {
    const inView = { panX: 0, panY: 300 - newest.y, zoom: 1 };
    expect(newestEnd(layout, inView, screen).panY).toBe(inView.panY);
    const below = newestEnd(layout, { panX: 0, panY: 10_000, zoom: 1 }, screen);
    expect(newest.y + below.panY).toBe(screen.height / 2);
  });

  it('is away from the newest end while the newest changeset is off screen to the right', () => {
    expect(awayFromNewest(layout, { panX: 0, panY: 0, zoom: 1 }, screen)).toBe(true);
    expect(awayFromNewest(layout, { panX: screen.width - newest.x - 1, panY: 0, zoom: 1 }, screen)).toBe(false);
  });

  it('counts the pending changes, past every changeset, as the newest end', () => {
    const history = sampleHistory();
    const withPending = layoutGraph(history, undefined, { branch: '/main/a', parent: 5, mergeLinks: [] });
    const pending = pendingPoint(withPending)!;
    // The newest changeset (7) in view, the pending changes a column past it off screen.
    const upToNewest = { panX: screen.width - nodePoint(withPending, 7)!.x - 1, panY: 0, zoom: 1 };
    expect(pending.x - nodePoint(withPending, 7)!.x).toBeGreaterThan(1);
    expect(awayFromNewest(layoutGraph(history), upToNewest, screen)).toBe(false);
    expect(awayFromNewest(withPending, upToNewest, screen)).toBe(true);
    expect(awayFromNewest(withPending, newestEnd(withPending, upToNewest, screen), screen)).toBe(false);
  });

  it('stays put with nothing drawn', () => {
    const empty = layoutGraph({ branches: [], changesets: [], mergeLinks: [], labels: [] });
    const viewport = { panX: 10, panY: 20, zoom: 1 };
    expect(newestEnd(empty, viewport, screen)).toBe(viewport);
    expect(awayFromNewest(empty, viewport, screen)).toBe(false);
  });
});

