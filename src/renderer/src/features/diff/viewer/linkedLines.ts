import type { FocusedLines } from '../../../app/navigation/pages';
import type { LineRange } from './lineSelection';

/**
 * Lines a link names (`#L40-L52`, `#old-L7`) as the range Pierre selects: the newer side's lines are its additions
 * side, the older one's its deletions side (unchanged lines are on both; Pierre selects them on either).
 */
export function selectedRangeOf({ side, first, last }: FocusedLines): LineRange {
  const pierreSide = side === 'old' ? 'deletions' : 'additions';
  return { start: first, side: pierreSide, end: last, endSide: pierreSide };
}

/**
 * The lines selected in a diff's gutter as a link names them: one side's, first to last. A link names one side only,
 * so a selection across both (the unified view, from a removed line down to an added one) keeps its end on the newer
 * side: the line it reached. None for no selection.
 */
export function linkedLinesOf(range: LineRange | null): FocusedLines | null {
  if (!range) return null;
  const startSide = range.side ?? 'additions';
  const endSide = range.endSide ?? startSide;
  if (startSide !== endSide) {
    const newerEnd = startSide === 'additions' ? range.start : range.end;
    return { side: 'new', first: newerEnd, last: newerEnd };
  }
  return { side: startSide === 'deletions' ? 'old' : 'new', first: Math.min(range.start, range.end), last: Math.max(range.start, range.end) };
}
