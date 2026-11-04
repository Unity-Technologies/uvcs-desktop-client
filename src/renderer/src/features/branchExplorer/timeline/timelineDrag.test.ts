import { describe, expect, it } from 'vitest';
import { sampleHistory } from '../model/graphFixtures';
import { layoutGraph } from '../model/layoutGraph';
import { rowY } from '../canvas/geometry';
import type { Viewport } from '../canvas/viewport';
import { timelineAxis, type TimelineAxis } from './timelineAxis';
import { viewportAfterDrag, viewportForDrag } from './timelineDrag';
import { viewportCenteredAt, viewportPannedBy, viewportWithEdgeAt } from './timelineFrame';

const axis: TimelineAxis = { worldWidth: 10_000, width: 1_000, inset: 0, columnCount: 150 };
const screen = { width: 800, height: 600 };
const viewport: Viewport = { zoom: 0.5, panX: -1_000, panY: 0 };

describe('viewportForDrag', () => {
  it('pans with the frame, zooms with an edge and scrubs anywhere else', () => {
    const step = { dx: 12, x: 420 };
    expect(viewportForDrag({ kind: 'pan' }, viewport, axis, screen, step)).toEqual(viewportPannedBy(viewport, axis, 12));
    expect(viewportForDrag({ kind: 'zoom', edge: 'right' }, viewport, axis, screen, step)).toEqual(viewportWithEdgeAt(viewport, axis, screen, 'right', 420));
    expect(viewportForDrag({ kind: 'scrub' }, viewport, axis, screen, step)).toEqual(viewportCenteredAt(viewport, axis, screen, 420));
  });
});

describe('viewportAfterDrag', () => {
  const layout = layoutGraph(sampleHistory());
  const real = timelineAxis(layout, 300);

  it('leaves the view where the drag left it when the landed row is in view', () => {
    expect(viewportAfterDrag(layout, { zoom: 1, panX: 0, panY: 0 }, real, screen)).toBeNull();
  });

  it('glides the landed row into view when it is out of it, at the same place in time', () => {
    const after = viewportAfterDrag(layout, { zoom: 1, panX: 0, panY: -3_000 }, real, screen)!;
    expect(after.panX).toBe(0);
    const rows = layout.nodesByColumn.map((node) => rowY(node.row) * after.zoom + after.panY);
    expect(rows.some((y) => Math.abs(y - screen.height / 2) < 1)).toBe(true);
  });
});
