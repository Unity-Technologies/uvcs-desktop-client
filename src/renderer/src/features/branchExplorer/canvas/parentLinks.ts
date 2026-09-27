import type { GraphLayout, NodeLayout } from '../model/layoutGraph';
import type { VisibleArea } from './drawContext';
import { columnX, rowY } from './geometry';
import { crossesView } from './linkVisibility';
import { SpanIndex } from './spanIndex';

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
  const { links, spans } = parentLinksOf(layout);
  const inView: ParentLink[] = [];
  for (const index of spans.overlapping(visible.left - margin, visible.right + margin, found)) {
    const link = links[index]!;
    const y = rowY(link.child.row);
    const line = { left: columnX(link.parent.column), right: columnX(link.child.column), top: y, bottom: y };
    if (crossesView(line, visible, margin)) inView.push(link);
  }
  return inView;
}

const linksByLayout = new WeakMap<GraphLayout, { links: ParentLink[]; spans: SpanIndex }>();
const found: number[] = [];

/** Every parent link of the layout, left to right, and where each one reaches: found once per layout. */
function parentLinksOf(layout: GraphLayout): { links: ParentLink[]; spans: SpanIndex } {
  let known = linksByLayout.get(layout);
  if (!known) {
    const links: ParentLink[] = [];
    for (const child of layout.nodesByColumn) {
      const parent = layout.nodes.get(child.changeset.parent);
      if (parent && parent !== child && parent.changeset.branch === child.changeset.branch) links.push({ parent, child });
    }
    known = { links, spans: new SpanIndex(links.map(({ parent }) => columnX(parent.column)), links.map(({ child }) => columnX(child.column))) };
    linksByLayout.set(layout, known);
  }
  return known;
}

/**
 * Whether the changeset's parent is not in the graph: older than the loaded dates, or on a branch
 * filtered out. Like gitgrove, the changeset then shows a short dashed line leading off to the left,
 * so the branch reads as continuing from somewhere instead of floating.
 */
export function hasParentOffGraph(layout: GraphLayout, node: NodeLayout): boolean {
  return node.collapsed === null && node.changeset.parent !== -1 && !layout.nodes.has(node.changeset.parent);
}
