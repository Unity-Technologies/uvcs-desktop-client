import type { GraphLayout } from '../model/layoutGraph';
import type { Point } from './curves';
import { nodePoint, pendingPoint } from './geometry';
import { graphExtent } from './laneShape';
import type { Size, Viewport } from './viewport';

/** How far in from the screen's edges the newest changeset's row counts as in view. */
const ROW_MARGIN = 40;

/** The newest thing drawn: the pending changes past every changeset, else the newest changeset. */
function newestPoint(layout: GraphLayout): Point | null {
  const newest = layout.nodesByColumn.at(-1);
  return pendingPoint(layout) ?? (newest ? nodePoint(layout, newest.changeset.id) : null);
}

/** Whether the newest changeset is off screen to the right: the view is back in older history. */
export function awayFromNewest(layout: GraphLayout, viewport: Viewport, screen: Size): boolean {
  const newest = newestPoint(layout);
  return newest !== null && newest.x * viewport.zoom + viewport.panX > screen.width;
}

/**
 * The view at the newest end of the history, at the same zoom: the graph's end at the right of the screen, and the
 * newest changeset's row brought into view (centered) only when it isn't.
 */
export function newestEnd(layout: GraphLayout, viewport: Viewport, screen: Size): Viewport {
  const newest = newestPoint(layout);
  if (!newest) return viewport;
  const panX = screen.width - graphExtent(layout).width * viewport.zoom;
  const y = newest.y * viewport.zoom + viewport.panY;
  const panY = y >= ROW_MARGIN && y <= screen.height - ROW_MARGIN ? viewport.panY : screen.height / 2 - newest.y * viewport.zoom;
  return { ...viewport, panX, panY };
}
