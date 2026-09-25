import { blockLines, type ChangeBlock, type ChangedLine, type ChangeRegion, type DiffSide } from './changeBlocks';

/** Lines picked in the diff's gutter, as `@pierre/diffs` reports them: from one line to another, possibly across sides. */
export interface LineRange {
  start: number;
  side?: DiffSide;
  end: number;
  endSide?: DiffSide;
}

/**
 * The changed lines a picked range covers. Rows are ordered as the unified view shows them (each block's removed
 * lines, then its added ones), so a range may start or end on an unchanged line. Side by side, a range that stays on
 * one side only takes that side's lines.
 */
export function changedLinesInRange(blocks: ChangeBlock[], range: LineRange, layout: 'split' | 'unified'): ChangedLine[] {
  const from = rowOf(blocks, range.side ?? 'additions', range.start);
  const to = rowOf(blocks, range.endSide ?? range.side ?? 'additions', range.end);
  const [first, last] = from <= to ? [from, to] : [to, from];
  const oneSide = layout === 'split' && (range.endSide ?? range.side) === range.side ? range.side : undefined;
  return blocks
    .flatMap(blockLines)
    .filter((line) => (!oneSide || line.side === oneSide) && rowOf(blocks, line.side, line.lineNumber) >= first && rowOf(blocks, line.side, line.lineNumber) <= last);
}

/** A range from a change's first line to its last, to show it picked. */
export function regionRange({ lines }: ChangeRegion): LineRange {
  const first = lines[0]!;
  const last = lines.at(-1)!;
  return { start: first.lineNumber, side: first.side, end: last.lineNumber, endSide: last.side };
}

/** Position of a line in the unified view: the lines of its own file above it plus the other file's changed lines above it. */
function rowOf(blocks: ChangeBlock[], side: DiffSide, lineNumber: number): number {
  let otherLinesAbove = 0;
  for (const block of blocks) {
    const [start, count, otherCount] = side === 'deletions' ? [block.oldStart, block.oldLines, block.newLines] : [block.newStart, block.newLines, block.oldLines];
    if (lineNumber >= start + count) otherLinesAbove += otherCount;
    else if (lineNumber >= start) {
      // Inside the block: its added lines come after all its removed ones.
      if (side === 'additions') otherLinesAbove += otherCount;
      break;
    } else break;
  }
  return lineNumber - 1 + otherLinesAbove;
}
