/**
 * How many conflicts start above the top of the view (`viewTop`), from where their header rows are (`tops`): where
 * the first move through them goes from. One starting at the very top is in view.
 */
export function conflictsAbove(tops: readonly number[], viewTop: number): number {
  return tops.filter((top) => top < viewTop).length;
}

/**
 * Selects a conflict's lines, their text and their numbers, by Pierre's `data-line-index` (unique in the file, unlike
 * a line number, which both sides of a conflict share): what lights up when the conflict is moved to (`flashCss`).
 */
export function conflictLinesSelector(lineIndexes: readonly string[]): string {
  return lineIndexes.map((index) => `[data-line-index="${index}"]`).join(',');
}
