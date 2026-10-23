import type { DisplayMeta } from './changeBlocks';
import { codeComparison, type CodeComparison } from './codeComparison';
import type { ComparisonMethod } from './comparisonMethod';
import type { MovedBlock } from './movedBlocks';
import { movedCopies } from './movedCopies';

/**
 * What "Compare moved code" shows of a move's two places (`movedCopies`): their diff when the code changed on the way,
 * else the code alone, saying so (`codeComparison`): code moved as it was is the commonest move. The code alone is the
 * text as the diff shows it.
 */
export function movedComparison(meta: DisplayMeta, move: MovedBlock, comparisonMethod: ComparisonMethod, fileName: string): CodeComparison {
  const { original, modified } = movedCopies(meta, move);
  return codeComparison(original, modified, comparisonMethod, fileName, 'Moved without changes');
}
