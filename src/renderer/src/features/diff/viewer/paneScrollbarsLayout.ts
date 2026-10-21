/** Where a pane of the diff is across its scrolling container, and how wide its code is. */
export interface PaneBar {
  left: number;
  width: number;
  scrollWidth: number;
}

/**
 * The panes have no scrollbar of their own: theirs would sit at the end of the file, out of sight, and show only while
 * hovered, so `PaneScrollbars` draws one per pane at the bottom of the view instead. Pierre is told their scrollbar
 * gutter is empty: it hides their bars, and pads the bottom of the code by its whole gap, as it pads the top, instead
 * of the gap less the bar it expects there (hiding the bars alone left 2 px under the last line).
 */
const NO_PANE_BARS_CSS = ':host{--diffs-scrollbar-gutter-override:0px}';

/**
 * While the bars show, they stay over the bottom of the view, taking no room of its own (`PaneScrollbars.module.css`),
 * so scrolled to the end they would cover the last line: the code makes room for them under it, past Pierre's gap.
 */
const ROOM_FOR_PANE_BARS_CSS = '[data-code]{padding-bottom:calc(var(--diffs-gap-block,var(--diffs-gap-fallback)) + var(--scrollbar-size))}';

/** A pane needs a bar when its lines are wider than it (by more than the pixel its width may round off). */
export function paneOverflows(bar: PaneBar): boolean {
  return bar.scrollWidth > bar.width + 1;
}

export function showsPaneBars(bars: readonly PaneBar[]): boolean {
  return bars.some(paneOverflows);
}

/** The style for the diff's shadow root that makes the panes' bottoms right for the bars `PaneScrollbars` shows. */
export function paneScrollbarsCss(showsBars: boolean): string {
  return showsBars ? `${NO_PANE_BARS_CSS}\n${ROOM_FOR_PANE_BARS_CSS}` : NO_PANE_BARS_CSS;
}

export function samePaneBars(a: readonly PaneBar[], b: readonly PaneBar[]): boolean {
  return a.length === b.length && a.every((bar, index) => bar.left === b[index]!.left && bar.width === b[index]!.width && bar.scrollWidth === b[index]!.scrollWidth);
}
