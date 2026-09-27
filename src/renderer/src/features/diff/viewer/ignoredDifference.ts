import type { ComparisonMethod } from './comparisonMethod';
import { differsUnder } from './lineDiff';

/** What two texts shown as equal by the comparison method still differ in. */
export type IgnoredDifference = 'lineEndings' | 'whitespace' | 'lineEndingsAndWhitespace';

export const IGNORED_DIFFERENCE_TITLES: Record<IgnoredDifference, string> = {
  lineEndings: 'Only line endings differ',
  whitespace: 'Only whitespace differs',
  lineEndingsAndWhitespace: 'Only line endings and whitespace differ',
};

/** For two different texts with no line changes under the comparison method. */
export function ignoredDifference(original: string, modified: string): IgnoredDifference {
  if (!differsUnder(original, modified, 'ignoreEol')) return 'lineEndings';
  if (!differsUnder(original, modified, 'ignoreWhitespace')) return 'whitespace';
  return 'lineEndingsAndWhitespace';
}

/** The methods that ignore more than each one, the one ignoring least first. */
const IGNORING_MORE: Record<ComparisonMethod, ComparisonMethod[]> = {
  recognizeAll: ['ignoreEol', 'ignoreWhitespace', 'ignoreEolAndWhitespace'],
  ignoreEol: ['ignoreEolAndWhitespace'],
  ignoreWhitespace: ['ignoreEolAndWhitespace'],
  ignoreEolAndWhitespace: [],
};

/**
 * For two texts with line changes under `method`: the method that would show none, when all they differ in is what it
 * ignores (a file whose line endings all changed shows every line changed otherwise). Null when they differ in more.
 */
export function methodHidingEveryChange(original: string, modified: string, method: ComparisonMethod): ComparisonMethod | null {
  return IGNORING_MORE[method].find((ignoring) => !differsUnder(original, modified, ignoring)) ?? null;
}
