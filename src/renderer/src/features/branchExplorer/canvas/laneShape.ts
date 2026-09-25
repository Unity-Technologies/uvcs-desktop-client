import type { Lane } from '../model/layoutGraph';
import { summaryOf } from './fitText';
import { BAND_HEIGHT, COLUMN_WIDTH, columnX, headerHeight, headerTop, NODE_RADIUS, rowY } from './geometry';

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

/** A lane's header card is two lines when the branch has a comment, one otherwise. */
export function laneHeaderHeight(lane: Lane): number {
  return headerHeight(summaryOf(lane.branch.comment) !== '');
}

/** Top of a lane's header card. */
export function laneHeaderTop(lane: Lane): number {
  return headerTop(rowY(lane.row), laneHeaderHeight(lane));
}
