/** Something to bring into view in a scrolled pane, from the top of its content: a commented line and its card. */
export interface Placed {
  /** Where it starts: the commented line, or a card. */
  top: number;
  /** Where what goes with it ends: the line's card, or the card itself. */
  bottom: number;
}

/**
 * Where to scroll a pane so a commented line and its card read with context (a comment gone to in the code, opened in
 * the context dialog): the line a third of the way down, lines of context above it, its card below. A card taller
 * than the room below scrolls on just enough to fit, keeping `contextAbove` above the line (the card cut instead);
 * a line near the top stays at the top, one near the end stops at the end.
 */
export function focusScrollTop({ top, bottom, contextAbove, viewHeight, contentHeight }: Placed & { contextAbove: number; viewHeight: number; contentHeight: number }): number {
  let scrollTop = top - viewHeight / 3;
  if (bottom - scrollTop > viewHeight) scrollTop = Math.min(bottom - viewHeight, top - contextAbove);
  return clampScrollTop(scrollTop, viewHeight, contentHeight);
}

function clampScrollTop(scrollTop: number, viewHeight: number, contentHeight: number): number {
  return Math.max(0, Math.min(scrollTop, contentHeight - viewHeight));
}
