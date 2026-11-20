import { parseDiffFromFile, type FileContents, type FileDiffMetadata } from '@pierre/diffs';

/**
 * A suggestion's diff as the code's own diff reads (docs/features/code-reviews.md "Suggested changes"): the line diff of
 * the lines it replaces against the lines it suggests, whole (every line of both in one hunk, so nothing folds), the
 * lines it keeps shown once, untinted, and the changed words of each line edited marked (`var` → `Shelve`), numbered as
 * the file's lines from the first one commented.
 *
 * It replaced GitHub's layout, every line replaced then every line suggested, once a comment could take a range and a
 * suggestion a whole method: lines kept read twice there, tinted red then green, and words were marked only when the
 * suggestion had as many lines as it replaced, as Pierre pairs the n-th line removed with the n-th added.
 */
export function suggestionLineDiff(replaced: FileContents, suggested: FileContents, firstLine: number): FileDiffMetadata {
  const lineCount = Math.max(lineCountOf(replaced.contents), lineCountOf(suggested.contents));
  const lineDiff = parseDiffFromFile(replaced, suggested, { context: lineCount });
  const offset = firstLine - 1;
  // Whole, though the texts are only the lines commented and suggested: Pierre's `FileDiff` loads the full files of a
  // partial diff (`loadDiffFiles`), and fails without them. Its line numbers come from the hunk's starts alone.
  return { ...lineDiff, isPartial: false, hunks: lineDiff.hunks.map((hunk) => numberedFrom(hunk, offset)) };
}

/**
 * A hunk numbered `offset` lines further down: a side with no lines starts at the line before them, as a unified diff's
 * header says (`-0,0` at the file's top), so it starts at the line before the first one commented.
 */
function numberedFrom(hunk: FileDiffMetadata['hunks'][number], offset: number): FileDiffMetadata['hunks'][number] {
  const deletionStart = hunk.deletionStart + offset;
  const additionStart = hunk.additionStart + offset;
  return { ...hunk, collapsedBefore: 0, deletionStart, additionStart, hunkSpecs: `@@ -${deletionStart},${hunk.deletionCount} +${additionStart},${hunk.additionCount} @@\n` };
}

function lineCountOf(text: string): number {
  return text.split('\n').length;
}
