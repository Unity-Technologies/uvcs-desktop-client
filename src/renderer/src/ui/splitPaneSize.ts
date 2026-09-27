import type { CSSProperties } from 'react';

/**
 * The sized pane's box: its size, capped so the other pane keeps at least the sized one's minimum. A size remembered
 * on a wide window (a details panel dragged wide) never crushes the list beside it once the window is narrower.
 */
export function sizedPaneStyle(horizontal: boolean, size: number, minSize: number): CSSProperties {
  const cap = `calc(100% - ${minSize}px)`;
  return horizontal ? { width: size, maxWidth: cap } : { height: size, maxHeight: cap };
}
