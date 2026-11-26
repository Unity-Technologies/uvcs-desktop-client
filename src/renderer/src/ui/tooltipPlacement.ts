/** Which side of what it points at a tooltip opens on. */
export type TooltipSide = 'above' | 'below';

export interface TooltipPlacement {
  top: number;
  left: number;
  side: TooltipSide;
  /** Where its caret points, from the bubble's left edge. */
  arrowX: number;
}

interface Size {
  width: number;
  height: number;
}

/** What a tooltip points at: the cursor, or the element it's about (a comment's pin), in client coordinates. */
export type TooltipAnchor = { pointer: { x: number; y: number } } | { element: { left: number; top: number; width: number; height: number } };

const MARGIN = 8;
/** Room for the cursor's own arrow between it and the tooltip. */
const POINTER_GAP = 18;
const ELEMENT_GAP = 6;
const ARROW_INSET = 18;
const ARROW_MIN = 14;

/**
 * Where a tooltip goes: on its preferred side of what it points at (below unless the element asks otherwise,
 * `data-tip-side`), flipping to the other when it doesn't fit there. It starts a little left of the cursor, or of the
 * element's middle, so its caret points at that; it shifts to stay on screen while the caret keeps pointing there.
 */
export function placeTooltip(anchor: TooltipAnchor, bubble: Size, viewport: Size, prefer: TooltipSide = 'below'): TooltipPlacement {
  const { x, above, below, left: wantedLeft } =
    'pointer' in anchor
      ? { x: anchor.pointer.x, above: anchor.pointer.y - POINTER_GAP, below: anchor.pointer.y + POINTER_GAP, left: anchor.pointer.x - ARROW_INSET }
      : {
          x: anchor.element.left + anchor.element.width / 2,
          above: anchor.element.top - ELEMENT_GAP,
          below: anchor.element.top + anchor.element.height + ELEMENT_GAP,
          left: anchor.element.left + anchor.element.width / 2 - ARROW_INSET,
        };
  const fits = prefer === 'below' ? below + bubble.height <= viewport.height - MARGIN : above - bubble.height >= MARGIN;
  const side: TooltipSide = fits ? prefer : prefer === 'below' ? 'above' : 'below';
  const top = Math.max(MARGIN, Math.min(side === 'below' ? below : above - bubble.height, viewport.height - bubble.height - MARGIN));
  const left = Math.max(MARGIN, Math.min(wantedLeft, viewport.width - bubble.width - MARGIN));
  const arrowX = Math.max(ARROW_MIN, Math.min(x - left, bubble.width - ARROW_MIN));
  return { top, left, side, arrowX };
}
