/** World-space measurements of the graph, before zooming. */
export const COLUMN_WIDTH = 64;
export const ROW_HEIGHT = 118;
export const NODE_RADIUS = 11;
/** Half the width of a "+N" node, the widest it gets. */
export const COLLAPSED_NODE_HALF_WIDTH = 20;
/** Branches are drawn as rounded bands the changesets sit on. */
export const BAND_HEIGHT = 30;
/**
 * Every branch has a header card sitting on top of its band: the name (and its chips) on one line, the comment in a
 * second, smaller line below it. A branch without a comment gets a one-line card.
 */
export const HEADER_HEIGHT = 22;
export const TWO_LINE_HEADER_HEIGHT = 36;
/** Where the lines of a card are centered, from its top. The name sits where it does on a one-line card. */
export const HEADER_NAME_MIDDLE = HEADER_HEIGHT / 2;
export const HEADER_COMMENT_MIDDLE = 25;
const HEADER_GAP = 5;
/** Header cards never grow wider than this many columns, so labels on those columns can move above them. */
export const HEADER_SPAN_COLUMNS = 4;
export const HEADER_MAX_WIDTH = HEADER_SPAN_COLUMNS * COLUMN_WIDTH - 8;
export const GRAPH_PADDING = { left: 56, top: 118, right: 140, bottom: 80 };

export function columnX(column: number): number {
  return GRAPH_PADDING.left + column * COLUMN_WIDTH;
}

export function rowY(row: number): number {
  return GRAPH_PADDING.top + row * ROW_HEIGHT;
}

export function headerHeight(hasComment: boolean): number {
  return hasComment ? TWO_LINE_HEADER_HEIGHT : HEADER_HEIGHT;
}

/** Top of a branch's header card `height` tall, for a band centered at `bandY`. */
export function headerTop(bandY: number, height = HEADER_HEIGHT): number {
  return bandY - BAND_HEIGHT / 2 - HEADER_GAP - height;
}

export function graphSize(columnCount: number, rowCount: number): { width: number; height: number } {
  return {
    width: columnX(Math.max(0, columnCount - 1)) + GRAPH_PADDING.right,
    height: rowY(Math.max(0, rowCount - 1)) + GRAPH_PADDING.bottom,
  };
}
