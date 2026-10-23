import type { DiffSide } from './changeBlocks';

/** A hunk's lines on each side, as Pierre's `Hunk` has them (unified-diff starts and counts, context included). */
export interface HunkSides {
  deletionStart: number;
  deletionCount: number;
  additionStart: number;
  additionCount: number;
}

/**
 * The line of the newer side to unfold (Pierre's `FileDiff.revealLine`, which expands only the folded region holding
 * it, from its nearer end) so that line `lineNumber` of `side` shows, a diff with "Collapse unchanged lines" folding
 * away the unchanged lines between changes. Pierre reveals only newer-side lines, as its editor holds that side, but a
 * folded region is the same unchanged lines on both sides, so an older side's line is the one as far into its region on
 * the newer side. None for an older side's line inside a change, which is never folded.
 */
export function lineToReveal(hunks: readonly HunkSides[], side: DiffSide, lineNumber: number): number | null {
  if (side === 'additions') return lineNumber;
  let newerEnd = 1;
  let olderEnd = 1;
  for (const hunk of hunks) {
    const [olderStart, olderStop] = sideRange(hunk.deletionStart, hunk.deletionCount);
    const [newerStart, newerStop] = sideRange(hunk.additionStart, hunk.additionCount);
    if (lineNumber < olderStart) return newerStart - (olderStart - lineNumber);
    if (lineNumber < olderStop) return null;
    [olderEnd, newerEnd] = [olderStop, newerStop];
  }
  return newerEnd + (lineNumber - olderEnd);
}

/** One side's one-based lines in a hunk, `[start, end)`, as Pierre reads a hunk header's start and count (`getHunkSideStartBoundary`). */
function sideRange(start: number, count: number): [number, number] {
  const first = (count === 0 ? start : start - 1) + 1;
  return [first, first + count];
}
