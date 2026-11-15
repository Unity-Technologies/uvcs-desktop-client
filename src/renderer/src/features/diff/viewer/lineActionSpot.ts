/** Where the line action's button is drawn (`useLineActionButton`): its left edge and its row's middle. */
export interface LineActionSpot {
  top: number;
  left: number;
}

/**
 * How far into the number cell the button starts: it sits just past the number, over the edge into its code, as a pull
 * request's "+" does. Over the number alone it hid it, and read as part of it.
 */
const INTO_NUMBER = 3;

/**
 * Where the button of the line under the pointer goes, in the container's scrolled content (so it scrolls with the
 * line): centered on the row of the line's number cell (a wrapped line's row is several lines tall), just inside its
 * right edge. `view` is the container's box and `scroll` how far it is scrolled.
 */
export function lineActionSpot(
  numberCell: { top: number; bottom: number; right: number },
  view: { top: number; left: number },
  scroll: { top: number; left: number },
): LineActionSpot {
  return {
    top: (numberCell.top + numberCell.bottom) / 2 - view.top + scroll.top,
    left: numberCell.right - INTO_NUMBER - view.left + scroll.left,
  };
}
