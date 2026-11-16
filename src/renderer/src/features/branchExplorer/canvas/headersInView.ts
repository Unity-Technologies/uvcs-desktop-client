import type { GraphLayout, Lane } from '../model/layoutGraph';
import { headerTop } from './geometry';
import { laneHeaderHeight, laneShape } from './laneShape';
import { lanesAcross } from './spansInView';

/** An area of the graph in world px. */
export interface WorldArea {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The lanes whose header falls inside `area`, in drawing order: those `drawBranchHeaders` draws. */
export function lanesWithHeadersIn(layout: GraphLayout, area: WorldArea): Lane[] {
  return lanesAcross(layout, area.left, area.right).filter((lane) => {
    const shape = laneShape(lane);
    const top = headerTop(shape.y, laneHeaderHeight(lane));
    return !(shape.right < area.left || shape.left > area.right || top > area.bottom || top + laneHeaderHeight(lane) < area.top);
  });
}

/** How far past each edge of the view a header counts as near: half the view's size, so a short pan finds it read. */
const NEAR_MARGIN = 0.5;

/**
 * The branches whose headers are in view or near it (`NEAR_MARGIN`), by id: those whose reviews the Branch Explorer
 * asks for (`useBranchReviews`), so a header's chip is read before it scrolls in, and nothing far from view is.
 */
export function branchesNearView(layout: GraphLayout, visible: WorldArea): number[] {
  const marginX = (visible.right - visible.left) * NEAR_MARGIN;
  const marginY = (visible.bottom - visible.top) * NEAR_MARGIN;
  const near = { left: visible.left - marginX, right: visible.right + marginX, top: visible.top - marginY, bottom: visible.bottom + marginY };
  return lanesWithHeadersIn(layout, near).map((lane) => lane.branch.id);
}
