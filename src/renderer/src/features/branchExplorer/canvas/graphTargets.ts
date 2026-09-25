import type { GraphLabel, MergeLink } from '@shared/domain/branchExplorer';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { GraphLayout, Lane, NodeLayout } from '../model/layoutGraph';
import type { DrawnTargets } from './drawContext';
import type { DrawnBox } from './drawnBoxes';
import { distanceToCurve, linkCurve, type Point } from './curves';
import { BAND_HEIGHT, COLLAPSED_NODE_HALF_WIDTH, COLUMN_WIDTH, columnX, GRAPH_PADDING, NODE_RADIUS, ROW_HEIGHT, rowY } from './geometry';
import { estimatedLabelWidth, LABEL_HEIGHT, labelTop } from './labelPlacement';
import { laneShape } from './laneShape';

/** Something the pointer can be on. */
export type GraphTarget =
  | { kind: 'changeset'; id: number }
  /** A "+N" node standing for changesets collapsed by "Only relevant changesets". */
  | { kind: 'collapsed'; node: NodeLayout }
  | { kind: 'label'; label: GraphLabel }
  | { kind: 'branch'; lane: Lane }
  | { kind: 'mergeLink'; link: MergeLink }
  /** The code review chip in a branch's header card. */
  | { kind: 'codeReview'; review: CodeReviewSummary };

/**
 * The hover card for what the pointer is on. A changeset's card completes its comment over its caption, whether the
 * pointer is on the node or on the caption: one card, so moving between them never closes it (a changeset whose
 * caption isn't drawn gets its card by the pointer). A branch gets no card: its two-line header already says it all,
 * and a card there would cover the changesets the pointer is heading to. Only a header whose name or comment was cut
 * gets a plain tooltip by the pointer, from the header itself. Anything else gets its card by the pointer.
 * The boxes are the last frame's, reused by the next one: read them right away.
 */
export type HoverCard =
  | { kind: 'caption'; target: Extract<GraphTarget, { kind: 'changeset' }>; caption: DrawnBox<NodeLayout> }
  | { kind: 'pointer'; target: GraphTarget };

export function hoverCardFor(target: GraphTarget | null, point: Point, drawn: DrawnTargets | null): HoverCard | null {
  if (!target) return null;
  if (target.kind === 'changeset') {
    const caption = drawn?.captions.find((node) => node.changeset.id === target.id);
    return caption ? { kind: 'caption', target, caption } : { kind: 'pointer', target };
  }
  if (target.kind === 'branch') {
    const header = drawn?.branchHeaders.at(point);
    return header?.item === target.lane && header.cut ? { kind: 'pointer', target } : null;
  }
  return { kind: 'pointer', target };
}

const NODE_HIT_RADIUS = NODE_RADIUS + 4;
const LINE_HIT_DISTANCE = 6;

export function nodePoint(layout: GraphLayout, changesetId: number): Point | null {
  const node = layout.nodes.get(changesetId);
  return node ? { x: columnX(node.column), y: rowY(node.row) } : null;
}

/**
 * Finds what is under a world-space point, most specific first. What moves with the view or is cut to its room
 * (code review chips, branch headers pinned to the edge, comments) is hit where the last frame drew it.
 * Code review chips only react to clicks: for anything else, `chips: false` makes them part of their header.
 */
export function hitTest(layout: GraphLayout, point: Point, drawn: DrawnTargets | null = null, { chips = true } = {}): GraphTarget | null {
  const chip = chips ? drawn?.reviewChips.at(point) : null;
  if (chip) return { kind: 'codeReview', review: chip.item };
  const header = drawn?.branchHeaders.at(point);
  if (header) return { kind: 'branch', lane: header.item };
  const caption = drawn?.captions.at(point);
  return (
    hitChangeset(layout, point) ??
    hitLabel(layout, point) ??
    (caption ? { kind: 'changeset', id: caption.item.changeset.id } : null) ??
    hitMergeLink(layout, point) ??
    hitLane(layout, point)
  );
}

function hitChangeset(layout: GraphLayout, point: Point): GraphTarget | null {
  const node = layout.nodesByColumn[Math.round((point.x - GRAPH_PADDING.left) / COLUMN_WIDTH)];
  if (!node) return null;
  if (node.collapsed) {
    const inside = Math.abs(columnX(node.column) - point.x) <= COLLAPSED_NODE_HALF_WIDTH && Math.abs(rowY(node.row) - point.y) <= NODE_HIT_RADIUS;
    return inside ? { kind: 'collapsed', node } : null;
  }
  const distance = Math.hypot(columnX(node.column) - point.x, rowY(node.row) - point.y);
  return distance <= NODE_HIT_RADIUS ? { kind: 'changeset', id: node.changeset.id } : null;
}

function hitLabel(layout: GraphLayout, point: Point): GraphTarget | null {
  const node = layout.nodesByColumn[Math.round((point.x - GRAPH_PADDING.left) / COLUMN_WIDTH)];
  const labels = node ? layout.labelsByChangeset.get(node.changeset.id) : undefined;
  if (!node || !labels) return null;

  const label = labels.find((candidate, index) => {
    const top = labelTop(layout, node, index);
    const halfWidth = estimatedLabelWidth(candidate.name) / 2;
    return point.y >= top && point.y <= top + LABEL_HEIGHT && Math.abs(columnX(node.column) - point.x) <= halfWidth;
  });
  return label ? { kind: 'label', label } : null;
}

function hitMergeLink(layout: GraphLayout, point: Point): GraphTarget | null {
  for (const link of layout.mergeLinks) {
    const from = nodePoint(layout, link.sourceChangeset)!;
    const to = nodePoint(layout, link.destinationChangeset)!;
    const outsideBounds =
      point.x < Math.min(from.x, to.x) - LINE_HIT_DISTANCE ||
      point.x > Math.max(from.x, to.x) + LINE_HIT_DISTANCE ||
      point.y < Math.min(from.y, to.y) - LINE_HIT_DISTANCE ||
      point.y > Math.max(from.y, to.y) + LINE_HIT_DISTANCE;
    if (!outsideBounds && distanceToCurve(linkCurve(from, to), point) <= LINE_HIT_DISTANCE) return { kind: 'mergeLink', link };
  }
  return null;
}

/** A branch is its band (its header card is hit where it was drawn). */
function hitLane(layout: GraphLayout, point: Point): GraphTarget | null {
  const row = Math.round((point.y - GRAPH_PADDING.top) / ROW_HEIGHT);
  const lane = layout.lanesByRow.get(row)?.find((candidate) => {
    const shape = laneShape(candidate);
    return Math.abs(point.y - shape.y) <= BAND_HEIGHT / 2 && point.x >= shape.left && point.x <= shape.right;
  });
  return lane ? { kind: 'branch', lane } : null;
}
