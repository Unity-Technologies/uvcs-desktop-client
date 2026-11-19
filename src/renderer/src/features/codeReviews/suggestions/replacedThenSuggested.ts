import type { ChangeContent, FileDiffMetadata, Hunk } from '@pierre/diffs';

/**
 * A suggestion's diff laid out as GitHub and GitLab lay out a suggested change (docs/features/code-reviews.md
 * "Suggested changes"): every line it replaces, then every line it suggests, numbered as the file's lines from the
 * first one commented. The line diff alone would mix them: wrapping a line in a new `if` is the `if` added, then the
 * line removed and added again, indented, which reads as if the `if` were there already.
 *
 * The changed words are marked (`30` → `60`) only when the suggestion's lines take the replaced ones' places one for
 * one (every change of the line diff `lineDiff` adds as many lines as it removes): Pierre marks the n-th line removed
 * against the n-th added, so otherwise it would mark lines that have nothing to do with each other.
 */
export function replacedThenSuggested(lineDiff: FileDiffMetadata, firstLine: number): FileDiffMetadata {
  const deletions = lineDiff.deletionLines.length;
  const additions = lineDiff.additionLines.length;
  const hunkContent = linesTakeTheSamePlaces(lineDiff) ? [change(deletions, additions)] : [change(deletions, 0), change(0, additions, deletions)];
  const changes = hunkContent.filter((part) => part.deletions + part.additions > 0);
  const splitLineCount = changes.reduce((rows, part) => rows + Math.max(part.deletions, part.additions), 0);
  const unifiedLineCount = deletions + additions;
  const hunk: Hunk = {
    collapsedBefore: 0,
    deletionStart: sideStart(firstLine, deletions),
    deletionCount: deletions,
    deletionLines: deletions,
    deletionLineIndex: 0,
    additionStart: sideStart(firstLine, additions),
    additionCount: additions,
    additionLines: additions,
    additionLineIndex: 0,
    hunkContent: changes,
    hunkSpecs: `@@ -${sideStart(firstLine, deletions)},${deletions} +${sideStart(firstLine, additions)},${additions} @@\n`,
    splitLineStart: 0,
    splitLineCount,
    unifiedLineStart: 0,
    unifiedLineCount,
    noEOFCRDeletions: false,
    noEOFCRAdditions: false,
  };
  // Whole, though the texts are only the lines commented and suggested: Pierre's `FileDiff` loads the full files of a
  // partial diff (`loadDiffFiles`), and fails without them. Its line numbers come from the hunk's starts alone, and
  // nothing shows before the hunk (`collapsedBefore: 0`) or after it (the texts end where it does).
  return { ...lineDiff, isPartial: false, hunks: [hunk], splitLineCount, unifiedLineCount };
}

function linesTakeTheSamePlaces(lineDiff: FileDiffMetadata): boolean {
  return lineDiff.hunks.every((hunk) => hunk.hunkContent.every((part) => part.type === 'context' || part.deletions === part.additions));
}

function change(deletions: number, additions: number, deletionLineIndex = 0): ChangeContent {
  return { type: 'change', deletions, deletionLineIndex, additions, additionLineIndex: 0 };
}

/** A hunk side's start as a diff's header writes it: its first line, or the line before it when it has none. */
function sideStart(firstLine: number, lines: number): number {
  return lines === 0 ? firstLine - 1 : firstLine;
}
