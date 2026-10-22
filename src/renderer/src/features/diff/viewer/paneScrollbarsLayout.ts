import { PANE_SCROLLBARS_ATTRIBUTE } from './paneScrollbarsDom';

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
 * While the bars show, they stay over the bottom of the view, taking no room of their own (`PaneScrollbars.module.css`),
 * so scrolled to the end they would cover the last line: the code makes room for them under it, past Pierre's gap.
 * It wins over Pierre's own padding of `[data-code]` because that one is in `@layer base` and this rule, in a style
 * sheet of our own in the shadow root (`useShadowStyle`), is in no layer. Pierre's `Virtualizer` doesn't know of this
 * room: it counts its gap alone under the last line (`getVirtualFilePaddingBottom`), so the code is a bar's thickness
 * taller than it computes. That's harmless: the room is past the last line, where nothing is placed by that height
 * (the lines in view and the spacers before them come from the lines above it), and scrolling to the end, or
 * typing on the last line, still shows that line whole above the bars.
 */
const ROOM_FOR_PANE_BARS_CSS = '[data-code]{padding-bottom:calc(var(--diffs-gap-block,var(--diffs-gap-fallback)) + var(--scrollbar-size))}';

/**
 * The bar of a pane (its box on screen, the width of its code), placed in its scrolling container: from inside the
 * container's border (`clientLeft`), where the bars are positioned, or a framed container would scroll sideways by it.
 */
export function paneBarOf(
  pane: { left: number; clientWidth: number; scrollWidth: number },
  container: { left: number; clientLeft: number; scrollLeft: number },
): PaneBar {
  return { left: pane.left - container.left - container.clientLeft + container.scrollLeft, width: pane.clientWidth, scrollWidth: pane.scrollWidth };
}

/** A pane needs a bar when its lines are wider than it (by more than the pixel its width may round off). */
export function paneOverflows(bar: PaneBar): boolean {
  return bar.scrollWidth > bar.width + 1;
}

export function showsPaneBars(bars: readonly PaneBar[]): boolean {
  return bars.some(paneOverflows);
}

/**
 * The attributes of the element that holds the bars, which `PaneScrollbars` renders whether or not a bar shows (its view
 * never scrolls sideways while it's there): marked while one does, for what measures the bars (`paneScrollbarsHeight`)
 * and for the view's scroll padding.
 */
export function barsElementAttributes(bars: readonly PaneBar[]): { [PANE_SCROLLBARS_ATTRIBUTE]?: '' } {
  return showsPaneBars(bars) ? { [PANE_SCROLLBARS_ATTRIBUTE]: '' } : {};
}

/** The style for the diff's shadow root that makes the panes' bottoms right for the bars `PaneScrollbars` shows. */
export function paneScrollbarsCss(showsBars: boolean): string {
  return showsBars ? `${NO_PANE_BARS_CSS}\n${ROOM_FOR_PANE_BARS_CSS}` : NO_PANE_BARS_CSS;
}

export function samePaneBars(a: readonly PaneBar[], b: readonly PaneBar[]): boolean {
  return a.length === b.length && a.every((bar, index) => bar.left === b[index]!.left && bar.width === b[index]!.width && bar.scrollWidth === b[index]!.scrollWidth);
}
