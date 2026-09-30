import type { GraphLayout, Lane } from '../model/layoutGraph';
import { summaryOf } from './fitText';
import { BAND_HEIGHT, COLUMN_WIDTH, columnX, graphSize, HEADER_INSET, HEADER_MAX_WIDTH, headerHeight, headerTop, NODE_RADIUS, rowY } from './geometry';

/** Where the band of a branch without changesets starts, after its base changeset on the parent's band. */
const EMPTY_BRANCH_OFFSET = COLUMN_WIDTH * 0.6;
/** Room around the first and last changesets inside the band. */
const BAND_INSET = NODE_RADIUS + 7;
/** Even a branch without changesets gets a short visible band. */
const MINIMUM_WIDTH = BAND_HEIGHT * 1.6;

export interface LaneShape {
  /** Where the band starts and ends, in world coordinates. */
  left: number;
  right: number;
  y: number;
}

/** The band of a lane: around its own changesets, or a short stub after its base for an empty branch. */
export function laneShape(lane: Lane): LaneShape {
  const y = rowY(lane.row);
  if (lane.firstOwnColumn === null) {
    const left = columnX(lane.startColumn) + EMPTY_BRANCH_OFFSET;
    return { left, right: left + MINIMUM_WIDTH, y };
  }
  const left = columnX(lane.firstOwnColumn) - BAND_INSET;
  return { left, right: Math.max(columnX(lane.endColumn) + BAND_INSET, left + MINIMUM_WIDTH), y };
}

/** Keeps what a branch draws past its band (its header card, its zoomed-out name) clear of the next band on its row. */
const NEXT_LANE_CLEARANCE = 12;

/**
 * How much room there is from `left` (world x) to the next branch's band on the lane's row, less a clearance;
 * infinite when no band follows. A binary search: a row holds up to thousands of branches, and every branch on
 * screen asks each frame.
 */
export function roomBeforeNextLane(layout: GraphLayout, lane: Lane, left: number): number {
  const lefts = bandLeftsOnRow(layout, lane.row);
  let low = 0;
  let high = lefts.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (lefts[middle]! <= left) low = middle + 1;
    else high = middle;
  }
  const next = low < lefts.length ? lefts[low]! : Number.POSITIVE_INFINITY;
  return next - left - NEXT_LANE_CLEARANCE;
}

const bandLeftsByLayout = new WeakMap<GraphLayout, Map<number, Float64Array>>();

/** Where the bands of a row start, ascending; measured once per row and layout. */
function bandLeftsOnRow(layout: GraphLayout, row: number): Float64Array {
  let byRow = bandLeftsByLayout.get(layout);
  if (!byRow) {
    byRow = new Map();
    bandLeftsByLayout.set(layout, byRow);
  }
  let lefts = byRow.get(row);
  if (!lefts) {
    lefts = Float64Array.from(layout.lanesByRow.get(row) ?? [], (other) => laneShape(other).left).sort();
    byRow.set(row, lefts);
  }
  return lefts;
}

/** A lane's header card is two lines when the branch has a comment, one otherwise. */
export function laneHeaderHeight(lane: Lane): number {
  return headerHeight(summaryOf(lane.branch.comment) !== '');
}

/** Top of a lane's header card. */
export function laneHeaderTop(lane: Lane): number {
  return headerTop(rowY(lane.row), laneHeaderHeight(lane));
}

/** Room kept to the right of the widest header card a branch starting near the end can get. */
const HEADER_END_MARGIN = 16;

const extents = new WeakMap<GraphLayout, { width: number; height: number }>();

/**
 * How big the graph is in the world: its changesets (and the pending one) with their padding, and wide enough for the header card of a
 * branch starting at the end (a new branch, the latest task) to scroll into view whole. Kept per layout: panning asks
 * for it every frame.
 */
export function graphExtent(layout: GraphLayout): { width: number; height: number } {
  let extent = extents.get(layout);
  if (!extent) {
    const size = graphSize(layout.columnCount + (layout.pending ? 1 : 0), layout.rowCount);
    let width = size.width;
    for (const lane of layout.lanes) width = Math.max(width, laneShape(lane).left + HEADER_INSET + HEADER_MAX_WIDTH + HEADER_END_MARGIN);
    extents.set(layout, (extent = { width, height: size.height }));
  }
  return extent;
}
