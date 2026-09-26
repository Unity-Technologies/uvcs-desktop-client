import { parseDiffFromFile, type FileContents, type FileDiffMetadata } from '@pierre/diffs';
import type { LineDiffOptions } from './comparisonMethod';
import { showsNoNewlineMarker } from './noNewlineMarker';

/**
 * The diff of two versions as the viewer shows it.
 *
 * - Both sides, whatever they hold. Pierre takes a diff from an empty file as a new file and one to an empty file as a
 *   deleted file, and shows those in one column even side by side; here every diff follows the Split/Unified choice,
 *   and an empty side shows as the hatched gap of any added or removed lines. While the file is typed into, Pierre
 *   keeps the kind the diff started with.
 * - "No newline at end of file" only where the final line break is what changed (`showsNoNewlineMarker`).
 */
export function shownDiff(oldFile: FileContents, newFile: FileContents, options: LineDiffOptions): FileDiffMetadata {
  const diff = parseDiffFromFile(oldFile, newFile, options);
  const type = diff.type === 'new' || diff.type === 'deleted' ? 'change' : diff.type;
  const hunks = showsNoNewlineMarker(oldFile.contents, newFile.contents)
    ? diff.hunks
    : diff.hunks.map((hunk) => ({ ...hunk, noEOFCRAdditions: false, noEOFCRDeletions: false }));
  return { ...diff, type, hunks };
}
