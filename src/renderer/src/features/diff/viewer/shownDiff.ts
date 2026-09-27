import type { FileDiffMetadata } from '@pierre/diffs';
import { endsWithLineBreak, splitLines } from '../../../lib/lineBreaks';
import { showsNoNewlineMarker } from './noNewlineMarker';

/** Whether each side is a real version (a revision, or the file on disk), or missing: an added or private item has no
 * earlier version, a deleted one no file on disk. */
export interface DiffSides {
  original: boolean;
  modified: boolean;
}

/**
 * The diff of two versions (`lineDiff`, of `original` and `modified`) as the viewer shows it.
 *
 * - An item with a missing side (added, private, deleted) shows its one version alone, in one column. Two real
 *   versions show both sides even when one is empty: Pierre takes a diff from an empty file as a new file (and to an
 *   empty file as a deleted one) and would drop a column, so here it follows the Split/Unified choice, the empty side
 *   showing as the hatched gap of any added or removed lines. While the file is typed into, Pierre keeps the kind the
 *   diff started with.
 * - "No newline at end of file" only where the final line break is what changed (`showsNoNewlineMarker`). A diff typed
 *   into keeps its marker rows, hidden (`HIDE_NO_NEWLINE_CSS`): Pierre works them out again at every keystroke, and
 *   while typing within a line it only recolors the rows it rendered when there are as many as the diff has now, so
 *   left out, a line typed into a file without a final line break never showed as changed.
 */
export function shownDiff(diff: FileDiffMetadata, sides: DiffSides, original: string, modified: string, typedInto = false): FileDiffMetadata {
  const type = (diff.type === 'new' && sides.original) || (diff.type === 'deleted' && sides.modified) ? 'change' : diff.type;
  // Copies of the hunks: Pierre edits the ones it's given in place as the file is typed into, and the diff they come
  // from is also what the header counts and discards read.
  const markers = typedInto || showsNoNewlineMarker(original, modified);
  const hunks = diff.hunks.map((hunk) => (markers ? { ...hunk } : { ...hunk, noEOFCRAdditions: false, noEOFCRDeletions: false }));
  return { ...diff, type, hunks };
}

/** Whether Split/Unified changes how a diff shows: two versions, not one alone (`shownDiff`) nor a file typed into whole. */
export function followsLayout(sides: DiffSides, wholeFile: boolean): boolean {
  return sides.original && sides.modified && !wholeFile;
}

/**
 * The editor always has a line for the caret after the text's last line break, and the one line of an empty text:
 * Pierre shows it as added when the diff's last change removes more lines than it adds (a file emptied, or typed down
 * to fewer lines at its end). It isn't a line of the file (the header counts none, and there is nothing to discard on
 * it), so it looks like any unchanged empty line.
 */
export function caretLineCss(text: string): string {
  if (text !== '' && !endsWithLineBreak(text)) return '';
  const line = splitLines(text).length + 1;
  const rows = `:is([data-additions],[data-unified]) :is([data-line="${line}"],[data-column-number="${line}"])[data-line-type="change-addition"]`;
  return `${rows}{--diffs-diff-line-mix-target:var(--diffs-bg);color:var(--diffs-fg-number);cursor:text}\n${rows}::before{display:none}`;
}
