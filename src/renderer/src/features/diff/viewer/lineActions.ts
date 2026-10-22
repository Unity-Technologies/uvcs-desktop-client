import type { FocusedLines } from '../../../app/navigation/pages';
import type { ChangedLine, DiffSide } from './changeBlocks';
import { linkedLinesOf } from './linkedLines';
import type { LineRange } from './lineSelection';

/** How the code is laid out: a diff side by side or unified, or one file (an annotation). */
export type CodeLayout = 'split' | 'unified' | 'file';

/** The hint a line number gives on hover, where lines are selected for links; none while a selection is dragged. */
export function lineNumberHint(selecting: boolean): string | null {
  return selecting ? null : 'Click to select · Shift+click a range';
}

/**
 * The line the "Copy link" chip sits by: the first of the lines selected, as the link names them; none without a
 * selection, or where no link names them (`linkable`: a workspace's own changes, a history under an xlink).
 */
export function lineChipAnchor(range: LineRange | null, linkable: boolean): ChangedLine | null {
  const lines = linkable ? linkedLinesOf(range) : null;
  return lines && { side: sideOf(lines), lineNumber: lines.first };
}

/**
 * The number cell of a line: side by side, in its side's pane; unified, a removed line's own cell, else the one an
 * unchanged or added line has (an unchanged line's number there is the newer side's); in a file, the only one.
 */
export function lineNumberCellSelector({ side, lineNumber }: ChangedLine, layout: CodeLayout): string {
  const cell = `[data-column-number="${lineNumber}"]`;
  if (layout === 'split') return `[data-${side}] ${cell}`;
  if (layout === 'unified') return side === 'deletions' ? `${cell}[data-line-type="change-deletion"]` : `${cell}:not([data-line-type="change-deletion"])`;
  return cell;
}

/** What a pointer's row says about its line: its number (cell or code), its type, and the pane it's in side by side. */
export interface RowUnderPointer {
  lineNumber: number;
  lineType: string | null;
  /** The pane holding it side by side; null unified or in a file. */
  pane: DiffSide | null;
}

/** The line a right-click is on: the older side's for a removed line or a line in the older pane, else the newer's. */
export function lineUnderPointer({ lineNumber, lineType, pane }: RowUnderPointer): ChangedLine | null {
  if (!Number.isInteger(lineNumber) || lineNumber < 1) return null;
  const side: DiffSide = pane ?? (lineType === 'change-deletion' ? 'deletions' : 'additions');
  return { side, lineNumber };
}

/** The selection a right-click on `clicked` makes: what is selected when the line is in it, else that line alone. */
export function rightClickSelection(selected: LineRange | null, clicked: ChangedLine): LineRange {
  const lines = linkedLinesOf(selected);
  const inside = lines && sideOf(lines) === clicked.side && clicked.lineNumber >= lines.first && clicked.lineNumber <= lines.last;
  return inside ? selected! : { start: clicked.lineNumber, side: clicked.side, end: clicked.lineNumber, endSide: clicked.side };
}

/** The text of lines `first` to `last` of a side, whatever its line breaks, joined by `\n`. */
export function linesText(text: string, { first, last }: FocusedLines): string {
  return text.split(/\r\n|\n|\r/).slice(first - 1, last).join('\n');
}

/**
 * The lines a right-click's menu acts on (`useLineTools`): the selection it makes on the line clicked
 * (`rightClickSelection`), else what is selected; null off any line with none selected, where no menu opens.
 */
export function contextMenuSelection(selected: LineRange | null, clicked: ChangedLine | null): LineRange | null {
  const selection = clicked ? rightClickSelection(selected, clicked) : selected;
  return linkedLinesOf(selection) ? selection : null;
}

/** What the toast says "Copy line" copied: "Line", "Lines". */
export function copiedLinesWord({ first, last }: FocusedLines): string {
  return first === last ? 'Line' : 'Lines';
}

/** "line 42", "lines 40–52": how a menu names the lines selected. */
export function linesWords({ first, last }: FocusedLines): string {
  return first === last ? `line ${first}` : `lines ${first}–${last}`;
}

function sideOf(lines: FocusedLines): DiffSide {
  return lines.side === 'old' ? 'deletions' : 'additions';
}
