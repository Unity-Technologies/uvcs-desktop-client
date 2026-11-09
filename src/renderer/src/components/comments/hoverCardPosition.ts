/** A rectangle in the window, as `getBoundingClientRect` gives it. */
export interface AnchorBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const GAP = 6;
const MARGIN = 8;

/**
 * Where a chip's card (or an image's preview) goes, in the window: over the chip, its start at the chip's, or under
 * it when there's no room over it; never past the window's edges.
 */
export function hoverCardPosition(anchor: AnchorBox, card: { width: number; height: number }, window: { width: number; height: number }): { left: number; top: number } {
  const left = Math.min(Math.max(anchor.left, MARGIN), window.width - card.width - MARGIN);
  const above = anchor.top - GAP - card.height;
  const top = above >= MARGIN ? above : Math.min(anchor.bottom + GAP, window.height - card.height - MARGIN);
  return { left: Math.round(Math.max(left, MARGIN)), top: Math.round(top) };
}
