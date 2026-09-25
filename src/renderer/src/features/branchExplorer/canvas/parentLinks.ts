import type { GraphLayout, NodeLayout } from '../model/layoutGraph';
import type { VisibleArea } from './drawContext';
import { columnX, rowY } from './geometry';
import { crossesView } from './linkVisibility';

/** The line along a band from a changeset back to the previous one of the same branch. */
export interface ParentLink {
  parent: NodeLayout;
  child: NodeLayout;
}

/**
 * The parent links whose line crosses the visible area, even when both changesets are off screen:
 * a branch with a long gap between two changesets keeps its line while it spans the screen.
 */
export function parentLinksInView(layout: GraphLayout, visible: VisibleArea, margin: number): ParentLink[] {
  const links: ParentLink[] = [];
  // A child is always right of its parent, so children left of the screen have their whole line there too.
  for (let column = Math.max(0, visible.firstColumn); column < layout.nodesByColumn.length; column++) {
    const child = layout.nodesByColumn[column]!;
    const parent = layout.nodes.get(child.changeset.parent);
    if (!parent || parent === child || parent.changeset.branch !== child.changeset.branch) continue;

    const y = rowY(child.row);
    const line = { left: columnX(parent.column), right: columnX(child.column), top: y, bottom: y };
    if (crossesView(line, visible, margin)) links.push({ parent, child });
  }
  return links;
}

/**
 * Whether the changeset's parent is not in the graph: older than the loaded dates, or on a branch
 * filtered out. Like gitgrove, the changeset then shows a short dashed line leading off to the left,
 * so the branch reads as continuing from somewhere instead of floating.
 */
export function hasParentOffGraph(layout: GraphLayout, node: NodeLayout): boolean {
  return node.collapsed === null && node.changeset.parent !== -1 && !layout.nodes.has(node.changeset.parent);
}
