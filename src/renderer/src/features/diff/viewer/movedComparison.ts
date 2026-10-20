import type { DisplayMeta } from './changeBlocks';
import type { ComparisonMethod } from './comparisonMethod';
import { lineDiff, type LineDiff } from './lineDiff';
import type { MovedBlock } from './movedBlocks';
import { movedCopies } from './movedCopies';

/** What "Compare moved code" shows of a move's two places. */
export type MovedComparison = { kind: 'diff'; diff: LineDiff } | { kind: 'unchanged'; code: string; note: string };

export function movedComparison(meta: DisplayMeta, move: MovedBlock, comparisonMethod: ComparisonMethod, fileName: string): MovedComparison {
  const { original, modified } = movedCopies(meta, move);
  return { kind: 'diff', diff: lineDiff(original, modified, comparisonMethod, fileName) };
}
