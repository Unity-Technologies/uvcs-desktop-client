import type { FocusedLines } from '../../../app/navigation/pages';
import type { DiffLayout } from './diffPreferencesStore';
import { collapsesUnchanged } from './lineLinkMode';
import type { LineAtTop } from './rowPosition';

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

/**
 * What the file shown overrides: a line too long to draw unwrapped wraps them all, a link's lines unfold the file, a
 * file typed into whole has no unchanged lines to collapse, and a version shown alone no Split | Unified to follow.
 */
export interface LayoutOverrides {
  wrapsLongLines: boolean;
  focusLines: FocusedLines | undefined;
  wholeFile: boolean;
  followsLayout: boolean;
}

/** The place noted just before the lines are laid out anew, for the layout it was noted for. */
export interface KeptPlace {
  place: LineAtTop;
  for: LinesLayout;
}

/** How the lines are drawn under `preferences` (`TextDiff` draws them so). */
export function linesLayoutOf(preferences: LinesLayout, { wrapsLongLines, focusLines, wholeFile, followsLayout }: LayoutOverrides): LinesLayout {
  return {
    // A layout it doesn't follow reads as one, so switching it lays nothing out anew.
    layout: followsLayout ? preferences.layout : 'unified',
    collapseUnchanged: !wholeFile && collapsesUnchanged(preferences.collapseUnchanged, focusLines),
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
 * The place kept as the preferences change from `before` to `after`, read from the screen (`readTop`) before the
 * lines are drawn anew: noted afresh when they will be laid out otherwise, else what was kept stays as it was.
 */
export function notedPlace(kept: KeptPlace | null, before: LinesLayout, after: LinesLayout, readTop: () => LineAtTop | null): KeptPlace | null {
  if (!relaysOut(before, after)) return kept;
  const place = readTop();
  return place && { place, for: after };
}

/**
 * Where the line kept goes from the top of the view, once laid out `height` tall: where its row stood, or, partly
 * scrolled past, as much of it scrolled past as before (a wrapped line unwrapped is a row, not ten).
 */
export function keptOffset({ offset, height: keptHeight }: LineAtTop, height: number): number {
  return offset >= 0 || keptHeight <= 0 ? offset : (offset / keptHeight) * height;
}
