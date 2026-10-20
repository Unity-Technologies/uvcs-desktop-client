import { lineBreakOf, shownText } from '../../../lib/lineBreaks';
import type { DisplayMeta } from './changeBlocks';
import type { ComparisonMethod } from './comparisonMethod';
import { IGNORED_DIFFERENCE_TITLES, ignoredDifference } from './ignoredDifference';
import { hasLineChanges, lineDiff, type LineDiff } from './lineDiff';
import type { MovedBlock } from './movedBlocks';
import { movedCopies } from './movedCopies';

/**
 * What "Compare moved code" shows of a move's two places (`movedCopies`): their diff when the code changed on the way,
 * else the code alone, with a note saying so. The diff of two texts with no line changes has no lines to show at all
 * (`hasLineChanges`), so code moved as it was, the commonest move, would show an empty diff. The code alone is shown
 * as a diff shows it (`shownText`), without its last line break: Pierre's `File` shows an empty line after one.
 */
export type MovedComparison = { kind: 'diff'; diff: LineDiff } | { kind: 'unchanged'; code: string; note: string };

export function movedComparison(meta: DisplayMeta, move: MovedBlock, comparisonMethod: ComparisonMethod, fileName: string): MovedComparison {
  const { original, modified } = movedCopies(meta, move);
  const diff = lineDiff(original, modified, comparisonMethod, fileName);
  if (hasLineChanges(diff)) return { kind: 'diff', diff };
  const note = original === modified ? 'Moved without changes' : IGNORED_DIFFERENCE_TITLES[ignoredDifference(original, modified)];
  const code = shownText(modified);
  return { kind: 'unchanged', code: code.slice(0, code.length - lineBreakOf(code).length), note };
}
