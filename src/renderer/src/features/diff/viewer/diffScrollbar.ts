/**
 * The diff's own vertical scrollbar, drawn while the change map shows (`ChangeMap`): its track holds the marks, and its
 * thumb is drawn over them. The browser's bar is hidden then, so the thumb's size, place and drag are worked out here,
 * as the browser does: the thumb is the view's share of the track, and runs from the top of the track to its bottom as
 * the view scrolls from the top of the content to its end.
 */

/** The thumb is never shorter than this, so it can be grabbed in a file of any length. */
export const MIN_THUMB_HEIGHT = 24;

export interface ScrollGeometry {
  scrollTop: number;
  /** The scrolling content's height (`scrollHeight`). */
  contentHeight: number;
  /** The view's height (`clientHeight`). */
  viewHeight: number;
  /** The track's height. */
  trackHeight: number;
}

export interface Thumb {
  top: number;
  height: number;
}

export function thumbOf({ scrollTop, contentHeight, viewHeight, trackHeight }: ScrollGeometry): Thumb {
  if (contentHeight <= viewHeight || trackHeight <= 0) return { top: 0, height: Math.max(0, trackHeight) };
  const height = Math.min(trackHeight, Math.max(MIN_THUMB_HEIGHT, (viewHeight / contentHeight) * trackHeight));
  const travel = trackHeight - height;
  const scrolled = Math.min(1, Math.max(0, scrollTop / (contentHeight - viewHeight)));
  return { top: scrolled * travel, height };
}

/**
 * Where the view scrolls to while the thumb is dragged: from where it stood as the drag started (`startScrollTop`), by
 * as much of the content as the pointer moved (`deltaY`) of the thumb's travel, within the content.
 */
export function scrollTopAfterDrag(startScrollTop: number, deltaY: number, geometry: Omit<ScrollGeometry, 'scrollTop'>): number {
  const { contentHeight, viewHeight } = geometry;
  const maxScroll = Math.max(0, contentHeight - viewHeight);
  const travel = geometry.trackHeight - thumbOf({ ...geometry, scrollTop: startScrollTop }).height;
  if (maxScroll === 0 || travel <= 0) return Math.min(maxScroll, Math.max(0, startScrollTop));
  return Math.min(maxScroll, Math.max(0, startScrollTop + (deltaY * maxScroll) / travel));
}

/**
 * Whether a press at `y` (from the track's top) takes hold of the thumb: anywhere across the track's width on the
 * thumb's rows, not only on the thin thumb drawn, so the thumb is as easy to grab as the track is wide.
 */
export function pressesThumb(y: number, thumb: Thumb): boolean {
  return y >= thumb.top && y <= thumb.top + thumb.height;
}
