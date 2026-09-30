import type { GraphSelection } from '../graphSelection';
import type { GraphLayout } from '../model/layoutGraph';
import type { Point } from './curves';
import { nodePoint, pendingPoint } from './geometry';
import type { GraphTarget } from './graphTargets';
import { laneHeaderTop, laneShape } from './laneShape';

/** Where in a header card a reveal aims: far enough in to show the start of the name. */
const HEADER_REVEAL_INSET = 60;

/** Where the view goes to show a selection: a changeset or the pending changes where drawn, a branch at its header card. */
export function selectionPoint(layout: GraphLayout, selection: GraphSelection): Point | null {
  switch (selection.kind) {
    case 'changeset':
      return nodePoint(layout, selection.id);
    case 'pending':
      return pendingPoint(layout);
    case 'branch':
      return headerPoint(layout, selection.name);
  }
}

/**
 * Where the keyboard opens a target's context menu, as a right click there would: a changeset, and a label, at the
 * changeset's node; a branch at its header card. Null for what the keyboard never opens a menu on.
 */
export function menuPoint(layout: GraphLayout, target: GraphTarget): Point | null {
  switch (target.kind) {
    case 'changeset':
      return nodePoint(layout, target.id);
    case 'label':
      return nodePoint(layout, target.label.changeset);
    case 'branch':
      return headerPoint(layout, target.lane.branch.name);
    default:
      return null;
  }
}

function headerPoint(layout: GraphLayout, branch: string): Point | null {
  const lane = layout.lanesByBranch.get(branch);
  return lane ? { x: laneShape(lane).left + HEADER_REVEAL_INSET, y: laneHeaderTop(lane) } : null;
}
