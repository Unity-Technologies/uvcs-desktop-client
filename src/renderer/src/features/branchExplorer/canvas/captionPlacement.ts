import type { GraphLayout, NodeLayout } from '../model/layoutGraph';
import { BAND_HEIGHT, COLUMN_WIDTH, columnX, rowY } from './geometry';
import { nextColumnOnRow } from './rowNeighbors';
import type { Viewport } from './viewport';

/** Comments start a little left of their changeset and may use the free space up to the next one on the row. */
const CAPTION_INSET = COLUMN_WIDTH / 2 - 6;
const GAP_BEFORE_NEXT = 8;
/** The last changeset of a row has no neighbor to stop at. */
const LAST_CAPTION_WIDTH = 260;

/** Where a changeset's comment starts (world x). */
export function captionLeft(node: NodeLayout): number {
  return columnX(node.column) - CAPTION_INSET;
}

/** How wide a changeset's comment may get before it reaches the next one on its row (world px). */
export function captionRoom(layout: GraphLayout, node: NodeLayout): number {
  const next = nextColumnOnRow(layout, node.column);
  return next === -1 ? LAST_CAPTION_WIDTH : columnX(next) - CAPTION_INSET - captionLeft(node) - GAP_BEFORE_NEXT;
}

/**
 * The screen y of the middle of a changeset's comment. The text keeps its screen size at every zoom, so its gap
 * below the band grows only a little with the zoom: close enough to read as the changeset's, never on the band.
 */
export function captionMiddle(node: NodeLayout, viewport: Viewport): number {
  const bandBottom = (rowY(node.row) + BAND_HEIGHT / 2) * viewport.zoom + viewport.panY;
  return bandBottom + 8 + 4 * viewport.zoom;
}
