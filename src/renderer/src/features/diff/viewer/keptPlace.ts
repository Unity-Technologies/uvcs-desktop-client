import type { FocusedLines } from '../../../app/navigation/pages';
import type { ChangedLine } from './changeBlocks';
import type { DiffLayout } from './diffPreferencesStore';
import { collapsesUnchanged } from './lineLinkMode';

/**
 * Switching how a diff lays its lines out (unchanged lines collapsed or all shown, split or unified, wrapped or not)
 * keeps the user's place: the line at the top of the view stays there, where its row stood (`useKeptPlace`).
 */

/** How the diff on screen lays its lines out, as drawn: what the preferences ask, as the file allows. */
export interface LinesLayout {
  layout: DiffLayout;
  collapseUnchanged: boolean;
  wrapLines: boolean;
}

/** What the file shown overrides: a line too long to draw unwrapped wraps them all, a link's lines unfold the file. */
export interface LayoutOverrides {
  wrapsLongLines: boolean;
  focusLines: FocusedLines | undefined;
}

/** The first line in view, and where its row starts from the top of the view (negative when partly scrolled past). */
export interface LineAtTop {
  line: ChangedLine;
  offset: number;
}

/** The place noted just before the lines are laid out anew, for the layout it was noted for. */
export interface KeptPlace {
  place: LineAtTop;
  for: LinesLayout;
}

/** How the lines are drawn under `preferences` (`TextDiff` draws them so). */
export function linesLayoutOf(preferences: LinesLayout, { wrapsLongLines, focusLines }: LayoutOverrides): LinesLayout {
  return {
    layout: preferences.layout,
    collapseUnchanged: collapsesUnchanged(preferences.collapseUnchanged, focusLines),
    wrapLines: preferences.wrapLines || wrapsLongLines,
  };
}

/** Whether the lines are drawn otherwise: only then does the view lose its place, and is it kept. */
export function relaysOut(before: LinesLayout, after: LinesLayout): boolean {
  return before.layout !== after.layout || before.collapseUnchanged !== after.collapseUnchanged || before.wrapLines !== after.wrapLines;
}

/**
 * The place to put back once the lines are drawn as `shown`: the one kept for that very layout, else none (kept for
 * another, or already put back).
 */
export function placeToRestore(kept: KeptPlace | null, shown: LinesLayout): LineAtTop | null {
  return kept && !relaysOut(kept.for, shown) ? kept.place : null;
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

/**
 * The place kept as the preferences change from `before` to `after`, read from the screen (`readTop`) before the
 * lines are drawn anew: noted afresh when they will be laid out otherwise, else what was kept stays as it was.
 */
export function notedPlace(kept: KeptPlace | null, before: LinesLayout, after: LinesLayout, readTop: () => LineAtTop | null): KeptPlace | null {
  if (!relaysOut(before, after)) return kept;
  const place = readTop();
  return place && { place, for: after };
}
