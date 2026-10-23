import type { ChangedLine } from './changeBlocks';

/** The first line in view, where its row starts from the top of the view (negative when partly scrolled past), and its height. */
export interface LineAtTop {
  line: ChangedLine;
  offset: number;
  height: number;
}

/** How far down from the top of the view the first line is looked for, and how finely. */
export const TOP_PROBE_REACH = 240;
const TOP_PROBE_STEP = 8;
/** Across the view: the modified side, then the original's (side by side; in Unified both land on the same row). */
const TOP_PROBE_SIDES = [0.75, 0.25] as const;

export interface ViewBox {
  left: number;
  top: number;
  width: number;
  bottom: number;
}

/**
 * The points the first line in view is looked for at, in order: down from the top of the view, at each height the
 * modified side then the original's. The first rows may be a bar of collapsed lines; side by side, the space across
 * from removed lines is a gap on the modified side, and on the original's across from added ones.
 */
export function topProbePoints(view: ViewBox): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let y = view.top + 1; y < Math.min(view.bottom, view.top + TOP_PROBE_REACH); y += TOP_PROBE_STEP) {
    for (const side of TOP_PROBE_SIDES) points.push({ x: view.left + view.width * side, y });
  }
  return points;
}

/**
 * The line a row of the diff stands for, from its `data-line` and `data-line-type`: none for what isn't a line (a bar
 * of collapsed lines, the gap across from removed lines); a removed line on the original's side.
 */
export function lineOfRow(lineNumber: string | undefined, lineType: string | undefined): ChangedLine | null {
  const number = Number(lineNumber);
  if (!Number.isInteger(number) || number < 1) return null;
  return { side: lineType === 'change-deletion' ? 'deletions' : 'additions', lineNumber: number };
}

/** The scroll position that puts a line laid out at `linePosition` at `offset` from the top of the view. */
export function scrollTopFor(linePosition: number, offset: number): number {
  return Math.max(0, linePosition - offset);
}
