/** Where a pane of the diff is across its scrolling container, and how wide its code is. */
export interface PaneBar {
  left: number;
  width: number;
  scrollWidth: number;
}

/** A pane needs a bar when its lines are wider than it (by more than the pixel its width may round off). */
export function paneOverflows(bar: PaneBar): boolean {
  return bar.scrollWidth > bar.width + 1;
}

export function showsPaneBars(bars: readonly PaneBar[]): boolean {
  return bars.some(paneOverflows);
}

export function samePaneBars(a: readonly PaneBar[], b: readonly PaneBar[]): boolean {
  return a.length === b.length && a.every((bar, index) => bar.left === b[index]!.left && bar.width === b[index]!.width && bar.scrollWidth === b[index]!.scrollWidth);
}
