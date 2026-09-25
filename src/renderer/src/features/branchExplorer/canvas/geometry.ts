/** World-space measurements of the graph, before zooming. */
export const COLUMN_WIDTH = 64;
export const ROW_HEIGHT = 104;
export const NODE_RADIUS = 11;
/** Branches are drawn as rounded bands the changesets sit on. */
export const BAND_HEIGHT = 30;
/** Every branch has a header card (name and comment) sitting on top of its band. */
export const HEADER_HEIGHT = 22;
const HEADER_GAP = 5;
/** Header cards never grow wider than this many columns, so labels on those columns can move above them. */
export const HEADER_SPAN_COLUMNS = 4;
export const HEADER_MAX_WIDTH = HEADER_SPAN_COLUMNS * COLUMN_WIDTH - 8;
export const GRAPH_PADDING = { left: 56, top: 104, right: 140, bottom: 80 };

export function columnX(column: number): number {
  return GRAPH_PADDING.left + column * COLUMN_WIDTH;
}

export function rowY(row: number): number {
  return GRAPH_PADDING.top + row * ROW_HEIGHT;
}

/** Top of a branch's header card, for a band centered at `bandY`. */
export function headerTop(bandY: number): number {
  return bandY - BAND_HEIGHT / 2 - HEADER_GAP - HEADER_HEIGHT;
}

export function graphSize(columnCount: number, rowCount: number): { width: number; height: number } {
  return {
    width: columnX(Math.max(0, columnCount - 1)) + GRAPH_PADDING.right,
    height: rowY(Math.max(0, rowCount - 1)) + GRAPH_PADDING.bottom,
  };
}
