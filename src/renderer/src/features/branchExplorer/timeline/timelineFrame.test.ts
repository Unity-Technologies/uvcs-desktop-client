import { describe, expect, it } from 'vitest';
import { layoutGraph } from '../model/layoutGraph';
import { sampleHistory } from '../model/graphFixtures';
import { columnX, rowY } from '../canvas/geometry';
import { graphExtent } from '../canvas/laneShape';
import { MAX_ZOOM, MIN_ZOOM, toWorld, type Viewport } from '../canvas/viewport';
import { HOUSE_RADIUS, HOUSE_REACH } from './timelineGeometry';
import { columnAtStrip, columnsBetween, stripXOfColumn, stripXOfWorld, TIMELINE_INSET, timelineAxis, worldXOfStrip, type TimelineAxis } from './timelineAxis';
import {
  frameCenteredAt,
  frameShape,
  viewportAtColumn,
  viewportCenteredAt,
  viewportFrame,
  viewportPannedBy,
  viewportShowingRow,
  viewportWithEdgeAt,
} from './timelineFrame';

/** A graph 10,000 world px wide on a strip 1,000 px wide: 10 world px per strip px. */
const axis: TimelineAxis = { worldWidth: 10_000, width: 1_000, inset: 0, columnCount: 150 };
const screen = { width: 800, height: 600 };

describe('timelineAxis', () => {
  it('squeezes the whole graph into the strip, its columns in order', () => {
    const layout = layoutGraph(sampleHistory());
    const real = timelineAxis(layout, 500);
    expect(real.worldWidth).toBe(graphExtent(layout).width);
    // The graph's ends a few px in from the strip's, so a frame or a house there stays whole and in reach.
    expect(stripXOfWorld(real, 0)).toBe(TIMELINE_INSET);
    expect(stripXOfWorld(real, real.worldWidth)).toBe(500 - TIMELINE_INSET);
    expect(stripXOfColumn(real, 3)).toBeCloseTo(TIMELINE_INSET + (columnX(3) * (500 - 2 * TIMELINE_INSET)) / real.worldWidth);
  });

  it('leaves room at each end for the whole house at the last column, its ring and shadow included', () => {
    const layout = layoutGraph(sampleHistory());
    const real = timelineAxis(layout, 800);
    expect(real.inset).toBeGreaterThanOrEqual(HOUSE_REACH);
    expect(HOUSE_REACH).toBeGreaterThan(HOUSE_RADIUS + 3);
    // The newest column, where the house stands with pending changes, keeps the house within the strip.
    expect(stripXOfColumn(real, layout.columnCount) + HOUSE_REACH).toBeLessThanOrEqual(real.width);
  });

  it('maps strip and world x both ways', () => {
    expect(worldXOfStrip(axis, stripXOfWorld(axis, 1234))).toBeCloseTo(1234);
  });

  it('finds the column nearest a point, never past the ends', () => {
    expect(columnAtStrip(axis, stripXOfColumn(axis, 42))).toBe(42);
    expect(columnAtStrip(axis, stripXOfColumn(axis, 42) + 2)).toBe(42);
    expect(columnAtStrip(axis, -50)).toBe(0);
    expect(columnAtStrip(axis, 5_000)).toBe(149);
  });

  it('finds the columns between two points, none when they fall between two', () => {
    expect(columnsBetween(axis, stripXOfColumn(axis, 10) - 1, stripXOfColumn(axis, 20) + 1)).toEqual({ first: 10, last: 20 });
    const between = columnsBetween(axis, stripXOfColumn(axis, 10) + 1, stripXOfColumn(axis, 10) + 2);
    expect(between.last).toBeLessThan(between.first);
  });
});

describe('the frame', () => {
  const viewport: Viewport = { zoom: 0.5, panX: -1_000, panY: 0 };

  it('is the viewport: what the screen shows of the graph, in strip px', () => {
    const frame = viewportFrame(axis, viewport, screen);
    // The screen shows world 2,000 to 3,600.
    expect(frame.left).toBeCloseTo(200);
    expect(frame.right).toBeCloseTo(360);
  });

  it('keeps its width while dragged, the canvas panning by as much', () => {
    const before = viewportFrame(axis, viewport, screen);
    const after = viewportFrame(axis, viewportPannedBy(viewport, axis, 30), screen);
    expect(after.left).toBeCloseTo(before.left + 30);
    expect(after.right - after.left).toBeCloseTo(before.right - before.left);
  });

  it('centers on a point at the same zoom and height', () => {
    const centered = viewportCenteredAt(viewport, axis, screen, 500);
    const frame = viewportFrame(axis, centered, screen);
    expect((frame.left + frame.right) / 2).toBeCloseTo(500);
    expect(centered.zoom).toBe(viewport.zoom);
    expect(centered.panY).toBe(viewport.panY);
  });

  it('zooms the canvas when an edge is dragged, the other edge staying where it was', () => {
    const before = viewportFrame(axis, viewport, screen);
    const widened = viewportFrame(axis, viewportWithEdgeAt(viewport, axis, screen, 'right', 440), screen);
    expect(widened.left).toBeCloseTo(before.left);
    expect(widened.right).toBeCloseTo(440);
    const narrowed = viewportFrame(axis, viewportWithEdgeAt(viewport, axis, screen, 'left', 300), screen);
    expect(narrowed.right).toBeCloseTo(before.right);
    expect(narrowed.left).toBeCloseTo(300);
  });

  it('stops where the zoom does, past MIN_ZOOM and MAX_ZOOM or across the other edge', () => {
    expect(viewportWithEdgeAt(viewport, axis, screen, 'right', 990).zoom).toBe(MIN_ZOOM);
    expect(viewportWithEdgeAt(viewport, axis, screen, 'right', 201).zoom).toBe(MAX_ZOOM);
    expect(viewportWithEdgeAt(viewport, axis, screen, 'right', 100).zoom).toBe(MAX_ZOOM);
    const stopped = viewportFrame(axis, viewportWithEdgeAt(viewport, axis, screen, 'left', 0), screen);
    expect(stopped.right).toBeCloseTo(360);
  });

  it('zooms around the middle of the screen’s height', () => {
    const tall: Viewport = { zoom: 1, panX: 0, panY: -300 };
    const middle = toWorld(tall, 0, screen.height / 2).y;
    const zoomed = viewportWithEdgeAt(tall, axis, screen, 'right', 40);
    expect(toWorld(zoomed, 0, screen.height / 2).y).toBeCloseTo(middle);
  });

  it('is a line under 4 px, a box from there, with edge handles only from 10 px', () => {
    expect(frameShape({ left: 10, right: 13.9 })).toBe('line');
    expect(frameShape({ left: 10, right: 14 })).toBe('box');
    expect(frameShape({ left: 10, right: 19.9 })).toBe('box');
    expect(frameShape({ left: 10, right: 20 })).toBe('boxWithEdges');
  });

  it('shows where a click would land as a frame of the same width there', () => {
    expect(frameCenteredAt({ left: 10, right: 30 }, 100)).toEqual({ left: 90, right: 110 });
  });
});

describe('landing on a column', () => {
  const layout = layoutGraph(sampleHistory());
  const real = timelineAxis(layout, 300);

  it('leaves the height alone when the row is in view', () => {
    const viewport: Viewport = { zoom: 1, panX: 0, panY: 0 };
    expect(viewportShowingRow(layout, viewport, screen, 0)).toBe(viewport);
  });

  it('centers the row when it is out of view', () => {
    const viewport: Viewport = { zoom: 1, panX: 0, panY: -2_000 };
    const shown = viewportShowingRow(layout, viewport, screen, 2);
    const row = layout.nodesByColumn[2]!.row;
    expect(rowY(row) * shown.zoom + shown.panY).toBeCloseTo(screen.height / 2);
    expect(shown.panX).toBe(viewport.panX);
  });

  it('centers the column and brings its row into view at once', () => {
    const viewport: Viewport = { zoom: 1, panX: 0, panY: -2_000 };
    const landed = viewportAtColumn(layout, viewport, real, screen, 4);
    expect(columnX(4) * landed.zoom + landed.panX).toBeCloseTo(screen.width / 2);
    expect(rowY(layout.nodesByColumn[4]!.row) * landed.zoom + landed.panY).toBeCloseTo(screen.height / 2);
  });
});
