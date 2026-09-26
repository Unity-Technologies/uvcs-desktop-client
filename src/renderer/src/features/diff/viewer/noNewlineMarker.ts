import { endsWithLineBreak } from '../../../lib/lineBreaks';

/**
 * Pierre ends a side that has no final line break with a "No newline at end of file" row, as `diff` does. It only
 * tells something when the line break is what changed; otherwise (neither side has one, or the other side is empty)
 * it's a row of noise under the last line, so it's hidden. A lone CR is a line break too.
 */
export function showsNoNewlineMarker(original: string, modified: string): boolean {
  return original !== '' && modified !== '' && endsWithLineBreak(original) !== endsWithLineBreak(modified);
}

/**
 * Hides the marker rows and their gutter gaps (`metadata` gaps are only drawn for them) that Pierre works out again
 * while the file is typed into; `shownDiff` leaves them out of the diff it starts from.
 */
export const HIDE_NO_NEWLINE_CSS = '[data-no-newline], [data-gutter-buffer="metadata"] { display: none; }';
