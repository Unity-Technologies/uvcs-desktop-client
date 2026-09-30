import { arrayDiff, lineDiff } from 'diff';
import { countCalls } from '@shared/testing/countCalls';

/**
 * How many comparisons of lines `diff`'s Myers algorithm makes while `run` runs (its `equals`, diffing arrays or
 * lines): the work of a diff, the same on any machine under any load, unlike the time it takes.
 */
export function countLineComparisons<T>(run: () => T): { result: T; comparisons: number } {
  const ofLines = countCalls(lineDiff, 'equals', () => countCalls(arrayDiff, 'equals', run));
  return { result: ofLines.result.result, comparisons: ofLines.calls + ofLines.result.calls };
}
