import type { GraphLabel, MergeLink } from '@shared/domain/branchExplorer';
import type { GraphLayout, Lane } from '../model/layoutGraph';
import { distanceToCurve, linkCurve, type Point } from './curves';
import { COLUMN_WIDTH, columnX, GRAPH_PADDING, NODE_RADIUS, ROW_HEIGHT, rowY } from './geometry';

/** Something the pointer can be on. */
export type GraphTarget =
  | { kind: 'changeset'; id: number }
  | { kind: 'label'; label: GraphLabel }
  | { kind: 'branch'; lane: Lane }
  | { kind: 'mergeLink'; link: MergeLink };

/** Labels are drawn as tags stacked above their changeset. */
export const LABEL_HEIGHT = 16;
export const LABEL_GAP = 3;
const LABEL_HALF_WIDTH = 34;

const NODE_HIT_RADIUS = NODE_RADIUS + 5;
const LINE_HIT_DISTANCE = 6;

export function nodePoint(layout: GraphLayout, changesetId: number): Point | null {
  const node = layout.nodes.get(changesetId);
  return node ? { x: columnX(node.column), y: rowY(node.row) } : null;
}

export function labelTop(changesetY: number, index: number): number {
  return changesetY - NODE_RADIUS - 6 - (index + 1) * (LABEL_HEIGHT + LABEL_GAP);
}

/** Finds what is under a world-space point, most specific first. */
export function hitTest(layout: GraphLayout, point: Point): GraphTarget | null {
  return hitChangeset(layout, point) ?? hitLabel(layout, point) ?? hitMergeLink(layout, point) ?? hitLane(layout, point);
}

function hitChangeset(layout: GraphLayout, point: Point): GraphTarget | null {
  const node = layout.nodesByColumn[Math.round((point.x - GRAPH_PADDING.left) / COLUMN_WIDTH)];
  if (!node) return null;
  const distance = Math.hypot(columnX(node.column) - point.x, rowY(node.row) - point.y);
  return distance <= NODE_HIT_RADIUS ? { kind: 'changeset', id: node.changeset.id } : null;
}

function hitLabel(layout: GraphLayout, point: Point): GraphTarget | null {
  const node = layout.nodesByColumn[Math.round((point.x - GRAPH_PADDING.left) / COLUMN_WIDTH)];
  const labels = node ? layout.labelsByChangeset.get(node.changeset.id) : undefined;
  if (!node || !labels || Math.abs(columnX(node.column) - point.x) > LABEL_HALF_WIDTH) return null;

  const index = labels.findIndex((_, position) => {
    const top = labelTop(rowY(node.row), position);
    return point.y >= top && point.y <= top + LABEL_HEIGHT;
  });
  return index === -1 ? null : { kind: 'label', label: labels[index]! };
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

function hitLane(layout: GraphLayout, point: Point): GraphTarget | null {
  const row = Math.round((point.y - GRAPH_PADDING.top) / ROW_HEIGHT);
  if (Math.abs(rowY(row) - point.y) > ROW_HEIGHT / 3) return null;
  const lane = layout.lanesByRow
    .get(row)
    ?.find((candidate) => point.x >= columnX(candidate.startColumn) - COLUMN_WIDTH * 3 && point.x <= columnX(candidate.endColumn) + COLUMN_WIDTH / 2);
  return lane ? { kind: 'branch', lane } : null;
}
