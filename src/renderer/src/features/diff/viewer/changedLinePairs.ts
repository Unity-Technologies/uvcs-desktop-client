import type { FileDiffMetadata } from '@pierre/diffs';

/**
 * How many pairs of changed lines a diff marks the changed words of, when Pierre's own rules would mark none (a plain
 * text diff past 1,000 lines) or only later (a diff typed into). Each pair is one word diff of two lines (Pierre's
 * `computeLineDiffDecorations`, lines past 1,000 characters skipped): measured at 0.004 ms for a line with one word
 * changed, 0.07 ms for an 80-character line rewritten, 7 ms for a 1,000-character one. That's at most 70 ms for a
 * thousand ordinary lines rewritten, and as much as Pierre already does for any diff of 1,000 lines; past it, a diff
 * shows its changed lines without marking their words, as Pierre does.
 */
export const MAX_WORD_DIFFED_LINE_PAIRS = 1_000;

/** A line the diff replaces and the line that replaces it, as indexes into its `deletionLines` and `additionLines`. */
export interface ChangedLinePair {
  deletion: number;
  addition: number;
}

/**
 * The pairs of lines the diff's changes replace, the ones whose words are diffed: within a change, its first removed
 * line with its first added line and so on, as Pierre pairs them (lines only added or only removed pair with none).
 */
export function changedLinePairs(diff: FileDiffMetadata): ChangedLinePair[] {
  const pairs: ChangedLinePair[] = [];
  for (const hunk of diff.hunks) {
    for (const part of hunk.hunkContent) {
      if (part.type !== 'change') continue;
      for (let index = 0; index < Math.min(part.additions, part.deletions); index++) {
        pairs.push({ deletion: part.deletionLineIndex + index, addition: part.additionLineIndex + index });
      }
    }
  }
  return pairs;
}

/** How many pairs of lines the diff's changes replace: the line diffs a render with word marks computes. */
export function wordDiffedLinePairs(diff: FileDiffMetadata): number {
  let pairs = 0;
  for (const hunk of diff.hunks) {
    for (const part of hunk.hunkContent) {
      if (part.type === 'change') pairs += Math.min(part.additions, part.deletions);
    }
  }
  return pairs;
}
