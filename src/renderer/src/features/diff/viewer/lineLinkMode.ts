import type { FocusedLines } from '../../../app/navigation/pages';
import type { SelectedLines } from '../selectedLinesStore';
import { linkedLinesOf, selectedRangeOf } from './linkedLines';
import type { LineRange } from './lineSelection';

/**
 * Whether a text diff's line numbers select lines for links: not where its gutter picks lines to discard them (a
 * workspace file's, `discards`), nor while its text is typed into (`editable`).
 */
export function linesSelectable({ discards, editable }: { discards: boolean; editable: boolean }): boolean {
  return !discards && !editable;
}

/** Whether a diff folds its unchanged lines: as the user prefers, except in a file a link opened on, which may name one. */
export function collapsesUnchanged(preference: boolean, focusLines: FocusedLines | undefined): boolean {
  return preference && !focusLines;
}

/**
 * The lines Pierre shows selected: the discard pick's while the diff offers discards (`undefined` from it means it
 * doesn't, null that nothing is picked), else the lines selected for a link.
 */
export function shownSelection(discardSelection: LineRange | null | undefined, linkSelection: LineRange | null | undefined): LineRange | null | undefined {
  return discardSelection !== undefined ? discardSelection : linkSelection;
}

/** The lines a view selects as it opens: a link's, where lines can be selected. */
export function initialSelectedRange(selectable: boolean, focusLines: FocusedLines | undefined): LineRange | null {
  return selectable && focusLines ? selectedRangeOf(focusLines) : null;
}

/** What a view publishes for "Copy link" (`selectLines`): the lines selected in its file; undefined where it publishes nothing. */
export function publishedSelection(publishes: boolean, path: string, range: LineRange | null): SelectedLines | null | undefined {
  if (!publishes) return undefined;
  const lines = linkedLinesOf(range);
  return lines ? { path, lines } : null;
}
