import { parseDiffFromFile, type FileContents, type FileDiffMetadata } from '@pierre/diffs';

/**
 * The unchanged lines a suggestion's diff keeps around each change; the rest of a run of unchanged lines folds, when
 * long enough (`SNIPPET_FOLDS_OVER`).
 */
export const SUGGESTION_CONTEXT_LINES = 3;

/**
 * A suggestion's diff as the code's own diff reads (docs/features/code-reviews.md "Suggested changes"): the line diff of
 * the lines it replaces against the lines it suggests, the lines it keeps shown once, untinted, and the changed words of
 * each line edited marked (`var` → `Shelve`), numbered as the file's lines from the first one commented. Its hunks keep
 * `SUGGESTION_CONTEXT_LINES` around each change, so a long run of lines kept between two changes (the first and last
 * lines of a method's body edited) can fold, as the box's options let only a long one (`pierreSnippetDiffOptions`).
 *
 * It replaced GitHub's layout, every line replaced then every line suggested, once a comment could take a range and a
 * suggestion a whole method: lines kept read twice there, tinted red then green, and words were marked only when the
 * suggestion had as many lines as it replaced, as Pierre pairs the n-th line removed with the n-th added.
 */
export function suggestionLineDiff(replaced: FileContents, suggested: FileContents, firstLine: number): FileDiffMetadata {
  const lineDiff = parseDiffFromFile(replaced, suggested, { context: SUGGESTION_CONTEXT_LINES });
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
  return { ...hunk, deletionStart, additionStart, hunkSpecs: `@@ -${deletionStart},${hunk.deletionCount} +${additionStart},${hunk.additionCount} @@\n` };
}
