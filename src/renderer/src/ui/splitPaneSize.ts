import type { CSSProperties } from 'react';

/**
 * The sized pane's box: its size, capped so the other pane keeps at least the sized one's minimum. A size remembered
 * on a wide window (a details panel dragged wide) never crushes the list beside it once the window is narrower.
 * `restMinSize` lets the other pane keep more than that (a file's diff beside its tree): the sized pane gives way
 * first, down to its own minimum.
 */
export function sizedPaneStyle(horizontal: boolean, size: number, minSize: number, restMinSize?: number): CSSProperties {
  const cap = restMinSize === undefined ? `calc(100% - ${minSize}px)` : `max(${minSize}px, calc(100% - ${restMinSize}px))`;
  return horizontal ? { width: size, maxWidth: cap } : { height: size, maxHeight: cap };
}
