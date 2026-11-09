import type { GraphLayout } from '../model/layoutGraph';
import { rowY } from '../canvas/geometry';
import { centerOn, MAX_ZOOM, MIN_ZOOM, toWorld, type Size, type Viewport } from '../canvas/viewport';
import { stripXOfColumn, stripXOfWorld, worldPerStripPx, worldXOfStrip, type TimelineAxis } from './timelineAxis';

/** The part of the strip the canvas shows: the viewport, in strip px. */
export interface TimelineFrame {
  left: number;
  right: number;
}

/** Narrower than this, the frame is a line with a handle, still dragged as a frame. */
export const FRAME_LINE_BELOW = 4;
/** From this wide on, its edges have handles that zoom the canvas. */
export const FRAME_EDGES_FROM = 10;

/** How the frame is drawn and grabbed at its width (zoomed far out on a long history it is a pixel wide). */
export type FrameShape = 'line' | 'box' | 'boxWithEdges';

export function viewportFrame(axis: TimelineAxis, viewport: Viewport, screen: Size): TimelineFrame {
  return {
    left: stripXOfWorld(axis, toWorld(viewport, 0, 0).x),
    right: stripXOfWorld(axis, toWorld(viewport, screen.width, 0).x),
  };
}

export function frameShape(frame: TimelineFrame): FrameShape {
  const width = frame.right - frame.left;
  if (width < FRAME_LINE_BELOW) return 'line';
  return width < FRAME_EDGES_FROM ? 'box' : 'boxWithEdges';
}

/** A frame of the same width centered on `x`: where a click there would take the view (the hover's ghost frame). */
export function frameCenteredAt(frame: TimelineFrame, x: number): TimelineFrame {
  const half = (frame.right - frame.left) / 2;
  return { left: x - half, right: x + half };
}

/** The view dragged with the frame by `dx` strip px: the canvas pans, at the same zoom. */
export function viewportPannedBy(viewport: Viewport, axis: TimelineAxis, dx: number): Viewport {
  return { ...viewport, panX: viewport.panX - dx * worldPerStripPx(axis) * viewport.zoom };
}

/** The view with the frame centered on `x`, at the same zoom and height. */
export function viewportCenteredAt(viewport: Viewport, axis: TimelineAxis, screen: Size, x: number): Viewport {
  return { ...viewport, panX: screen.width / 2 - worldXOfStrip(axis, x) * viewport.zoom };
}

/**
 * The view with one edge of the frame dragged to `x` and the other where it was: the canvas zooms (within `MIN_ZOOM`
 * and `MAX_ZOOM`, the edge stopping where the zoom does), around the middle of the screen's height.
 */
export function viewportWithEdgeAt(viewport: Viewport, axis: TimelineAxis, screen: Size, edge: 'left' | 'right', x: number): Viewport {
  const left = toWorld(viewport, 0, 0).x;
  const right = toWorld(viewport, screen.width, 0).x;
  const dragged = worldXOfStrip(axis, x);
  const span = edge === 'right' ? dragged - left : right - dragged;
  const zoom = span <= 0 ? MAX_ZOOM : Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, screen.width / span));
  const middleY = toWorld(viewport, 0, screen.height / 2).y;
  return {
    zoom,
    panX: edge === 'right' ? -left * zoom : screen.width - right * zoom,
    panY: screen.height / 2 - middleY * zoom,
  };
}

/** How far in from the top and bottom a row counts as in view. */
const ROW_MARGIN = 40;

/**
 * The view showing the row of the changeset at `column` (the pending changes past the last one): as it is when the row
 * is in view, else with the row centered, so landing somewhere from the Timeline never leaves an empty screen.
 */
export function viewportShowingRow(layout: GraphLayout, viewport: Viewport, screen: Size, column: number): Viewport {
  const row = column >= layout.columnCount ? layout.pending?.row : layout.nodesByColumn[column]?.row;
  if (row === undefined) return viewport;
  const y = rowY(row) * viewport.zoom + viewport.panY;
  if (y >= ROW_MARGIN && y <= screen.height - ROW_MARGIN) return viewport;
  const centered = centerOn(viewport, 0, rowY(row), screen);
  return { ...viewport, panY: centered.panY };
}

/** The view a click on the strip glides to: centered on the column, its row in view. */
export function viewportAtColumn(layout: GraphLayout, viewport: Viewport, axis: TimelineAxis, screen: Size, column: number): Viewport {
  return viewportShowingRow(layout, viewportCenteredAt(viewport, axis, screen, stripXOfColumn(axis, column)), screen, column);
}
