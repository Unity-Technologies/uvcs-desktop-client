import type { GraphLayout } from '../model/layoutGraph';
import { COLUMN_WIDTH, columnX, GRAPH_PADDING } from '../canvas/geometry';
import { graphExtent } from '../canvas/laneShape';

/**
 * The Timeline's horizontal axis: the canvas's own, the whole graph (changesets in column order) squeezed into the
 * strip's width. On it the viewport is a frame of its own width wherever it goes, and busy days take more width than
 * quiet ones, as on the canvas. A calendar axis was tried and dropped: the frame grew and shrank as it moved.
 */
export interface TimelineAxis {
  /** The graph's width in world px (`graphExtent`). */
  worldWidth: number;
  /** The strip's width in screen px. */
  width: number;
  columnCount: number;
}

export function timelineAxis(layout: GraphLayout, width: number): TimelineAxis {
  return { worldWidth: graphExtent(layout).width, width, columnCount: layout.columnCount };
}

/** Where a world x falls on the strip. */
export function stripXOfWorld(axis: TimelineAxis, worldX: number): number {
  return (worldX * axis.width) / axis.worldWidth;
}

/** The world x under a point of the strip. */
export function worldXOfStrip(axis: TimelineAxis, x: number): number {
  return (x * axis.worldWidth) / axis.width;
}

/** Where a column (a changeset, a "+N" node, the pending changes past them) falls on the strip. */
export function stripXOfColumn(axis: TimelineAxis, column: number): number {
  return stripXOfWorld(axis, columnX(column));
}

/** The changeset column nearest a point of the strip. */
export function columnAtStrip(axis: TimelineAxis, x: number): number {
  const column = Math.round((worldXOfStrip(axis, x) - GRAPH_PADDING.left) / COLUMN_WIDTH);
  return Math.min(axis.columnCount - 1, Math.max(0, column));
}

/** The first and last changeset columns between two points of the strip (none: `last` before `first`). */
export function columnsBetween(axis: TimelineAxis, left: number, right: number): { first: number; last: number } {
  const columnOf = (x: number): number => (worldXOfStrip(axis, x) - GRAPH_PADDING.left) / COLUMN_WIDTH;
  return { first: Math.max(0, Math.ceil(columnOf(left))), last: Math.min(axis.columnCount - 1, Math.floor(columnOf(right))) };
}
