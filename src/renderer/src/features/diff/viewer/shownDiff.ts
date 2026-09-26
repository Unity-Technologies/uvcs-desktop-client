import type { FileDiffMetadata } from '@pierre/diffs';
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
 * - "No newline at end of file" only where the final line break is what changed (`showsNoNewlineMarker`).
 */
export function shownDiff(diff: FileDiffMetadata, sides: DiffSides, original: string, modified: string): FileDiffMetadata {
  const type = (diff.type === 'new' && sides.original) || (diff.type === 'deleted' && sides.modified) ? 'change' : diff.type;
  // Copies of the hunks: Pierre edits the ones it's given in place as the file is typed into, and the diff they come
  // from is also what the header counts and discards read.
  const markers = showsNoNewlineMarker(original, modified);
  const hunks = diff.hunks.map((hunk) => (markers ? { ...hunk } : { ...hunk, noEOFCRAdditions: false, noEOFCRDeletions: false }));
  return { ...diff, type, hunks };
}
