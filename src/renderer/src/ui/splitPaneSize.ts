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

/**
 * What a pane of a split is: gone (`hidden`), out of sight but still mounted (`stowed`: the files beside an expanded
 * diff, which keep their scroll, selection and steps for when they show again), kept at its size, or taking the rest
 * (all of it once the other one is gone or stowed).
 */
export function paneRole(
  which: 'first' | 'second',
  sizedPane: 'first' | 'second',
  hidden: 'first' | 'second' | undefined,
  stowed?: 'first' | 'second',
): 'hidden' | 'stowed' | 'sized' | 'rest' {
  if (which === hidden) return 'hidden';
  if (which === stowed) return 'stowed';
  return which === sizedPane && hidden === undefined && stowed === undefined ? 'sized' : 'rest';
}
