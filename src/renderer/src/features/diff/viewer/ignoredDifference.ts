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
