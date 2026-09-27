export interface RowRange {
  /** First row rendered. */
  first: number;
  /** One past the last row rendered. */
  end: number;
}

interface Viewport {
  scrollTop: number;
  height: number;
}

interface RowLayout {
  count: number;
  rowHeight: number;
  /** Where the first row starts inside the scrolled content. */
  offsetTop: number;
  /** Rows rendered beyond each edge, so a fling doesn't show blank rows before the next frame. */
  overscan: number;
}

/** The rows of a list of fixed-height rows that are in view in a scrolled viewport, plus some overscan either side. */
export function visibleRows({ scrollTop, height }: Viewport, { count, rowHeight, offsetTop, overscan }: RowLayout): RowRange {
  const top = scrollTop - offsetTop;
  const first = Math.max(0, Math.min(count, Math.floor(top / rowHeight) - overscan));
  const end = Math.max(first, Math.min(count, Math.ceil((top + height) / rowHeight) + overscan));
  return { first, end };
}
