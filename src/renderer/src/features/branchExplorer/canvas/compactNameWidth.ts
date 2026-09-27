/** A zoomed-out branch name always gets this much room, even squeezed. */
const MIN_WIDTH = 60;
/** Past the end of its band, a name may run this far into free space. */
const RUN_PAST_BAND = 80;
/** Room kept from the right edge of the canvas. */
const EDGE_INSET = 6;

/**
 * How wide a zoomed-out branch name may be, in screen px, for a band from `left` to `right`: a little past the end
 * of its band, never into the next branch on its row (`roomBeforeNext`) nor past the right edge of the canvas, where
 * it would be cut mid-letter instead of shortened.
 */
export function compactNameWidth(left: number, right: number, roomBeforeNext: number, canvasWidth: number): number {
  return Math.max(MIN_WIDTH, Math.min(roomBeforeNext, right - left + RUN_PAST_BAND, canvasWidth - EDGE_INSET - left));
}
