import type { GraphLabel, MergeLink } from '@shared/domain/branchExplorer';
import type { CodeReview } from '@shared/domain/codeReview';
import type { GraphLayout, Lane, NodeLayout } from '../model/layoutGraph';
import { distanceToCurve, linkCurve, type Point } from './curves';
import { BAND_HEIGHT, COLLAPSED_NODE_HALF_WIDTH, COLUMN_WIDTH, columnX, GRAPH_PADDING, HEADER_HEIGHT, HEADER_MAX_WIDTH, headerTop, NODE_RADIUS, ROW_HEIGHT, rowY } from './geometry';
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
  | { kind: 'codeReview'; review: CodeReview };

const NODE_HIT_RADIUS = NODE_RADIUS + 4;
const LINE_HIT_DISTANCE = 6;

export function nodePoint(layout: GraphLayout, changesetId: number): Point | null {
  const node = layout.nodes.get(changesetId);
  return node ? { x: columnX(node.column), y: rowY(node.row) } : null;
}

/** Finds what is under a world-space point, most specific first. */
export function hitTest(layout: GraphLayout, point: Point): GraphTarget | null {
  return hitChangeset(layout, point) ?? hitLabel(layout, point) ?? hitMergeLink(layout, point) ?? hitLane(layout, point);
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

/** A branch is its band, plus the header card above the start of the band. */
function hitLane(layout: GraphLayout, point: Point): GraphTarget | null {
  const row = Math.round((point.y - GRAPH_PADDING.top + ROW_HEIGHT / 3) / ROW_HEIGHT);
  const lane = layout.lanesByRow.get(row)?.find((candidate) => {
    const shape = laneShape(candidate);
    const onBand = Math.abs(point.y - shape.y) <= BAND_HEIGHT / 2 && point.x >= shape.left && point.x <= shape.right;
    const top = headerTop(shape.y);
    const onHeader = point.y >= top && point.y <= top + HEADER_HEIGHT && point.x >= shape.left && point.x <= shape.left + HEADER_MAX_WIDTH;
    return onBand || onHeader;
  });
  return lane ? { kind: 'branch', lane } : null;
}
