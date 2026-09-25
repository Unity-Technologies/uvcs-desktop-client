/** World-space measurements of the graph, before zooming. */
export const COLUMN_WIDTH = 32;
export const ROW_HEIGHT = 54;
export const NODE_RADIUS = 6;
export const GRAPH_PADDING = { left: 150, top: 64, right: 80, bottom: 60 };

export function columnX(column: number): number {
  return GRAPH_PADDING.left + column * COLUMN_WIDTH;
}

export function rowY(row: number): number {
  return GRAPH_PADDING.top + row * ROW_HEIGHT;
}

export function graphSize(columnCount: number, rowCount: number): { width: number; height: number } {
  return {
    width: columnX(Math.max(0, columnCount - 1)) + GRAPH_PADDING.right,
    height: rowY(Math.max(0, rowCount - 1)) + GRAPH_PADDING.bottom,
  };
}
