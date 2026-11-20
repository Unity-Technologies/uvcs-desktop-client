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
 * line in unified layout, the other pane) leaves it where it was, as a comment takes one side's lines. It stretches
 * line by line only as far as the place `offers` the lines (a review's comment being written takes no other), so it
 * stops short of lines it couldn't act on rather than ending with nothing.
 */
export function lineActionDragTo(drag: LineActionDrag, line: ChangedLine, offers: (lines: ChangedLines) => boolean = () => true): LineActionDrag {
  if (line.side !== drag.from.side) return drag;
  const step = Math.sign(line.lineNumber - drag.to.lineNumber);
  let to = drag.to;
  for (let lineNumber = to.lineNumber + step; step !== 0 && (lineNumber - line.lineNumber) * step <= 0; lineNumber += step) {
    const next = { side: line.side, lineNumber };
    if (!offers(lineActionDragLines({ from: drag.from, to: next }))) break;
    to = next;
  }
  return to === drag.to ? drag : { from: drag.from, to };
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
