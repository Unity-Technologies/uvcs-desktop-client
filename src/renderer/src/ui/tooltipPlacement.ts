/** Which side of the cursor a tooltip opens on. */
export type TooltipSide = 'above' | 'below';

export interface TooltipPlacement {
  top: number;
  left: number;
  side: TooltipSide;
  /** Where its caret points, from the bubble's left edge: at the cursor. */
  arrowX: number;
}

interface Size {
  width: number;
  height: number;
}

const MARGIN = 8;
const GAP = 18;
const ARROW_INSET = 18;

/**
 * Where a tooltip goes: on its preferred side of the cursor (below unless the element asks otherwise, `data-tip-side`),
 * flipping to the other when it doesn't fit there. It starts a little left of the cursor and shifts to stay on screen,
 * while its caret keeps pointing at the cursor.
 */
export function placeTooltip(pointer: { x: number; y: number }, bubble: Size, viewport: Size, prefer: TooltipSide = 'below'): TooltipPlacement {
  const below = pointer.y + GAP;
  const above = pointer.y - GAP - bubble.height;
  const fits = prefer === 'below' ? below + bubble.height <= viewport.height - MARGIN : above >= MARGIN;
  const side: TooltipSide = fits ? prefer : prefer === 'below' ? 'above' : 'below';
  const top = Math.max(MARGIN, Math.min(side === 'below' ? below : above, viewport.height - bubble.height - MARGIN));
  const left = Math.max(MARGIN, Math.min(pointer.x - ARROW_INSET, viewport.width - bubble.width - MARGIN));
  const arrowX = Math.max(14, Math.min(pointer.x - left, bubble.width - 14));
  return { top, left, side, arrowX };
}
