import type { GraphSelection } from '../graphSelection';
import type { GraphLayout, NodeLayout } from '../model/layoutGraph';
import type { Point } from './curves';
import { COLUMN_WIDTH, columnX, GRAPH_PADDING, rowY } from './geometry';
import { selectionPoint } from './selectionPoint';
import { toWorld, type Size, type Viewport } from './viewport';

/** How far up its history a changeset that left the graph is followed to one still in it. */
const MAX_ANCESTOR_STEPS = 500;

/**
 * Where the view goes when the graph is laid out again (a filter, hidden branches, only relevant changesets, new
 * history), so the user doesn't lose their place: one thing on screen stays where it was on screen. Preferred first
 * (the selection, the home badge) while on screen, then the changesets on screen from the middle out. When none of
 * them is in the new graph, the nearest ancestor of one that is takes its place (a hidden branch's changeset gives
 * way to where the branch started, a collapsed one to its "+N" node). Null with nothing on screen to hold on to.
 */
export function keepPlace(before: GraphLayout, after: GraphLayout, viewport: Viewport, screen: Size, preferred: readonly GraphSelection[]): Viewport | null {
  if (before === after) return viewport;
  const topLeft = toWorld(viewport, 0, 0);
  const bottomRight = toWorld(viewport, screen.width, screen.height);
  const onScreen = (point: Point | null): point is Point =>
    point !== null && point.x >= topLeft.x && point.x <= bottomRight.x && point.y >= topLeft.y && point.y <= bottomRight.y;
  const keeping = (from: Point, to: Point): Viewport => ({
    ...viewport,
    panX: viewport.panX + (from.x - to.x) * viewport.zoom,
    panY: viewport.panY + (from.y - to.y) * viewport.zoom,
  });

  for (const selection of preferred) {
    const from = selectionPoint(before, selection);
    const to = onScreen(from) ? selectionPoint(after, selection) : null;
    if (to) return keeping(from!, to);
  }

  const middle = { x: (topLeft.x + bottomRight.x) / 2, y: (topLeft.y + bottomRight.y) / 2 };
  const visible = nodesIn(before, topLeft, bottomRight).sort((a, b) => distance(pointOf(a), middle) - distance(pointOf(b), middle));
  for (const node of visible) {
    const to = after.nodes.get(node.changeset.id);
    if (to) return keeping(pointOf(node), pointOf(to));
  }
  for (const node of visible) {
    const ancestor = ancestorIn(before, after, node.changeset.parent);
    if (ancestor) return keeping(pointOf(node), pointOf(ancestor));
  }
  return null;
}

function nodesIn(layout: GraphLayout, topLeft: Point, bottomRight: Point): NodeLayout[] {
  const first = Math.max(0, Math.ceil((topLeft.x - GRAPH_PADDING.left) / COLUMN_WIDTH));
  const last = Math.floor((bottomRight.x - GRAPH_PADDING.left) / COLUMN_WIDTH);
  return layout.nodesByColumn.slice(first, last + 1).filter((node) => {
    const y = rowY(node.row);
    return y >= topLeft.y && y <= bottomRight.y;
  });
}

/** The node of the first changeset from `id` up its parents that the new graph has, as far as the old one knew them. */
function ancestorIn(before: GraphLayout, after: GraphLayout, id: number): NodeLayout | null {
  for (let step = 0; step < MAX_ANCESTOR_STEPS && id >= 0; step++) {
    const found = after.nodes.get(id);
    if (found) return found;
    const node = before.nodes.get(id);
    const changeset = node && (node.changeset.id === id ? node.changeset : node.collapsed?.find((member) => member.id === id));
    if (!changeset) return null;
    id = changeset.parent;
  }
  return null;
}

function pointOf(node: NodeLayout): Point {
  return { x: columnX(node.column), y: rowY(node.row) };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
