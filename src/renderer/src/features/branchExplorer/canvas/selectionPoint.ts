import type { GraphSelection } from '../graphSelection';
import type { GraphLayout } from '../model/layoutGraph';
import type { Point } from './curves';
import { nodePoint, pendingPoint } from './geometry';
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
    case 'branch': {
      const lane = layout.lanesByBranch.get(selection.name);
      return lane ? { x: laneShape(lane).left + HEADER_REVEAL_INSET, y: laneHeaderTop(lane) } : null;
    }
  }
}
