import type { GraphLayout, NodeLayout } from '../model/layoutGraph';
import type { VisibleArea } from './drawContext';
import { columnX, GRAPH_PADDING, ROW_HEIGHT, rowY } from './geometry';
import { crossesView } from './linkVisibility';

/** The line along a band from a changeset back to the previous one of the same branch. */
export interface ParentLink {
  parent: NodeLayout;
  child: NodeLayout;
}

/**
 * The parent links whose line crosses the visible area, even when both changesets are off screen:
 * a branch with a long gap between two changesets keeps its line while it spans the screen. Left to right.
 */
export function parentLinksInView(layout: GraphLayout, visible: VisibleArea, margin: number): ParentLink[] {
  const links: ParentLink[] = [];
  const add = (child: NodeLayout): void => {
    const parent = layout.nodes.get(child.changeset.parent);
    if (!parent || parent === child || parent.changeset.branch !== child.changeset.branch) return;
    const y = rowY(child.row);
    const line = { left: columnX(parent.column), right: columnX(child.column), top: y, bottom: y };
    if (crossesView(line, visible, margin)) links.push({ parent, child });
  };
  // A child is always right of its parent: the lines of children left of the screen end there too.
  const lastColumn = Math.min(visible.lastColumn, layout.nodesByColumn.length - 1);
  for (let column = Math.max(0, visible.firstColumn); column <= lastColumn; column++) add(layout.nodesByColumn[column]!);

  // Past the right edge, only the next changeset of each row can have its line reach back onto the screen: a row's
  // changesets past it belong to one branch at a time, each linked to the one before.
  const past: NodeLayout[] = [];
  const rows = columnsByRow(layout);
  const firstRow = Math.max(0, Math.floor((visible.top - margin - GRAPH_PADDING.top) / ROW_HEIGHT));
  const lastRow = Math.min(rows.length - 1, Math.ceil((visible.bottom + margin - GRAPH_PADDING.top) / ROW_HEIGHT));
  for (let row = firstRow; row <= lastRow; row++) {
    const next = firstAfter(rows[row]!, lastColumn);
    if (next !== -1) past.push(layout.nodesByColumn[next]!);
  }
  past.sort((a, b) => a.column - b.column).forEach(add);
  return links;
}

const rowsByLayout = new WeakMap<GraphLayout, Int32Array[]>();

/** The columns of each row's changesets, left to right: found once per layout. */
function columnsByRow(layout: GraphLayout): Int32Array[] {
  let rows = rowsByLayout.get(layout);
  if (!rows) {
    const counts = new Int32Array(layout.rowCount + 1);
    for (const node of layout.nodesByColumn) counts[node.row]!++;
    rows = Array.from(counts, (count) => new Int32Array(count));
    const filled = new Int32Array(counts.length);
    for (const node of layout.nodesByColumn) rows[node.row]![filled[node.row]!++] = node.column;
    rowsByLayout.set(layout, rows);
  }
  return rows;
}

/** The first of the sorted columns past `column`, or -1. */
function firstAfter(columns: Int32Array, column: number): number {
  let low = 0;
  let high = columns.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (columns[middle]! <= column) low = middle + 1;
    else high = middle;
  }
  return low < columns.length ? columns[low]! : -1;
}

/**
 * Whether the changeset's parent is not in the graph: older than the loaded dates, or on a branch
 * filtered out. Like gitgrove, the changeset then shows a short dashed line leading off to the left,
 * so the branch reads as continuing from somewhere instead of floating.
 */
export function hasParentOffGraph(layout: GraphLayout, node: NodeLayout): boolean {
  return node.collapsed === null && node.changeset.parent !== -1 && !layout.nodes.has(node.changeset.parent);
}
