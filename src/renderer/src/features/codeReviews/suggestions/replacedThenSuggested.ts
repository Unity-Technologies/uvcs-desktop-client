import type { ChangeContent, ContextContent, FileDiffMetadata, Hunk } from '@pierre/diffs';

/**
 * A suggestion's diff laid out to read as a suggestion does: each changed part of the lines it replaces, then the
 * lines it suggests in their place (docs/features/code-reviews.md "Suggested changes"). The line diff can split one
 * part into changes side by side: wrapping a line in a new `if` is the `if` added, then the line removed and added
 * again, indented. Pierre draws them in that order, a new line above the one it replaces, and marks the words of
 * each removed line against the added one at its place in its change. Joined, the part reads as the lines replaced,
 * then the lines suggested, and no words are marked between lines the diff never paired (the old line and the `if`).
 * A part that's a single change is kept, its words marked as the code's diff marks them (`30` → `60`); the lines
 * the suggestion keeps stay where they are, between the parts. A range is laid out as one line is.
 */
export function replacedThenSuggested(diff: FileDiffMetadata): FileDiffMetadata {
  let splitRowsAdded = 0;
  const hunks = diff.hunks.map((hunk): Hunk => {
    const hunkContent = withChangesJoined(hunk.hunkContent);
    const splitLineCount = splitRowsOf(hunkContent);
    const joined = { ...hunk, hunkContent, splitLineStart: hunk.splitLineStart + splitRowsAdded, splitLineCount };
    splitRowsAdded += splitLineCount - hunk.splitLineCount;
    return joined;
  });
  return { ...diff, hunks, splitLineCount: diff.splitLineCount + splitRowsAdded };
}

type HunkPart = ContextContent | ChangeContent;

/** Each run of changes side by side as the lines it removes, then those it adds; a lone change as it is. */
function withChangesJoined(parts: readonly HunkPart[]): HunkPart[] {
  const joined: HunkPart[] = [];
  let run: ChangeContent[] = [];
  const endRun = () => {
    joined.push(...(run.length > 1 ? removedThenAdded(run) : run));
    run = [];
  };
  for (const part of parts) {
    if (part.type === 'change') {
      run.push(part);
    } else {
      endRun();
      joined.push(part);
    }
  }
  endRun();
  return joined;
}

/** Changes side by side, whose lines follow each other on both sides, as one removing them all and one adding them. */
function removedThenAdded(run: readonly ChangeContent[]): ChangeContent[] {
  const { deletionLineIndex, additionLineIndex } = run[0]!;
  const deletions = run.reduce((lines, change) => lines + change.deletions, 0);
  const additions = run.reduce((lines, change) => lines + change.additions, 0);
  const removed: ChangeContent = { type: 'change', deletions, deletionLineIndex, additions: 0, additionLineIndex };
  const added: ChangeContent = { type: 'change', deletions: 0, deletionLineIndex: deletionLineIndex + deletions, additions, additionLineIndex };
  return [removed, added].filter((change) => change.deletions + change.additions > 0);
}

/** The rows a hunk takes side by side: a kept line one, a change as many as its longer side. */
function splitRowsOf(parts: readonly HunkPart[]): number {
  return parts.reduce((rows, part) => rows + (part.type === 'context' ? part.lines : Math.max(part.deletions, part.additions)), 0);
}
