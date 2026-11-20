import type { ChangedLine } from './changeBlocks';
import type { ChangedLines, LineBand } from './diffAnnotations';

/**
 * A drag from the gutter's "+" (`useLineActionButton`), as GitHub's: pressed on one line (`from`), stretched over others
 * of its side (`to`), the action runs on all of them once released.
 */
export interface LineActionDrag {
  from: ChangedLine;
  to: ChangedLine;
}

export function lineActionDragFrom(line: ChangedLine): LineActionDrag {
  return { from: line, to: line };
}

/**
 * The drag reaching a line the pointer entered: one of its own side stretches it; one of the other side (a removed
 * line in unified layout, the other pane) leaves it where it was, as a comment takes one side's lines.
 */
export function lineActionDragTo(drag: LineActionDrag, line: ChangedLine): LineActionDrag {
  return line.side === drag.from.side ? { from: drag.from, to: line } : drag;
}

/** Whether the drag left the line it started on: released there, it's a click. */
export function lineActionDragMoved(drag: LineActionDrag): boolean {
  return drag.to.lineNumber !== drag.from.lineNumber;
}

/** The lines dragged over, first to last, whichever way the drag went. */
export function lineActionDragLines({ from, to }: LineActionDrag): ChangedLines {
  return { side: from.side, firstLineNumber: Math.min(from.lineNumber, to.lineNumber), lineNumber: Math.max(from.lineNumber, to.lineNumber) };
}


/** The outline of the lines dragged over, in the accent, as a comment being written is outlined. */
export function lineActionDragBand(drag: LineActionDrag): LineBand {
  const lines = lineActionDragLines(drag);
  return { key: LINE_ACTION_DRAG_KEY, side: lines.side, lineNumber: lines.lineNumber, ...(lines.firstLineNumber < lines.lineNumber && { firstLineNumber: lines.firstLineNumber }), selected: true };
}

/** The lines a "+" marks while dragging: the first and the last dragged over, one for one line. */
export function lineActionDragEnds(drag: LineActionDrag): (ChangedLine & { key: string })[] {
  const lines = lineActionDragLines(drag);
  const first = { key: 'first', side: lines.side, lineNumber: lines.firstLineNumber };
  return lines.lineNumber > lines.firstLineNumber ? [first, { key: 'last', side: lines.side, lineNumber: lines.lineNumber }] : [first];
}

const LINE_ACTION_DRAG_KEY = 'line-action-drag';

/** How wide the "+" is (`LineActionButton.module.css`): the line joining two runs down its middle. */
export const LINE_ACTION_BUTTON_SIZE = 22;

/**
 * The line joining a drag's two "+" (`LineActionDragMarks`), from the middle of the first line's row to the last's,
 * down the middle of the buttons that start at `left`: the two read as the ends of one handle. None until both rows
 * are rendered, or for one line.
 */
export function dragSpanRect(first: { top: number; bottom: number } | undefined, last: { top: number; bottom: number } | undefined, left: number): { top: number; left: number; height: number } | null {
  if (!first || !last) return null;
  const top = (first.top + first.bottom) / 2;
  const bottom = (last.top + last.bottom) / 2;
  return bottom > top ? { top, left: left + LINE_ACTION_BUTTON_SIZE / 2, height: bottom - top } : null;
}
