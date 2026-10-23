import { lineBreakOf } from '../../../lib/lineBreaks';
import type { ComparisonMethod } from './comparisonMethod';
import { IGNORED_DIFFERENCE_TITLES, ignoredDifference } from './ignoredDifference';
import { hasLineChanges, lineDiff, type LineDiff } from './lineDiff';

/**
 * What a dialog comparing two pieces of code shows (`openCodeComparisonDialog`): their diff when they differ, else the
 * code alone, with a note saying so. The diff of two texts with no line changes has no lines to show at all
 * (`hasLineChanges`), so two equal pieces would show an empty diff. The code alone is the newer piece without its last
 * line break: Pierre's `File` shows an empty line after one.
 */
export type CodeComparison = { kind: 'diff'; diff: LineDiff } | { kind: 'unchanged'; code: string; note: string };

/**
 * Compares `original` with `modified` under the comparison method. `sameNote` says they are the same text; when they
 * differ only in what the method ignores, the note says what that is.
 */
export function codeComparison(original: string, modified: string, comparisonMethod: ComparisonMethod, fileName: string, sameNote: string): CodeComparison {
  const diff = lineDiff(original, modified, comparisonMethod, fileName);
  if (hasLineChanges(diff)) return { kind: 'diff', diff };
  const note = original === modified ? sameNote : IGNORED_DIFFERENCE_TITLES[ignoredDifference(original, modified)];
  return { kind: 'unchanged', code: modified.slice(0, modified.length - lineBreakOf(modified).length), note };
}

/** The line under a comparison's title: what the two pieces are, then the note when they show as one. */
export function comparisonSubtitle(description: string, comparison: CodeComparison): string {
  return comparison.kind === 'unchanged' ? `${description} · ${comparison.note}` : description;
}
