import type { DisplayMeta } from './changeBlocks';
import { openCodeComparisonDialog } from './CodeComparisonDialog';
import type { ComparisonMethod } from './comparisonMethod';
import type { MovedBlock } from './movedBlocks';
import { movedComparison } from './movedComparison';

interface MovedCodeComparison {
  move: MovedBlock;
  /** The diff the move is in. */
  meta: DisplayMeta;
  fileName: string;
  comparisonMethod: ComparisonMethod;
}

/**
 * Compares a move's two places, what moved with what it became (`movedComparison`): only what changed on the way shows
 * as changed, and code moved as it was shows alone, saying so. In the diff's comparison method; the title says where
 * both places are.
 */
export function openMovedCodeDialog({ move, meta, fileName, comparisonMethod }: MovedCodeComparison): void {
  openCodeComparisonDialog({
    title: `Moved from ${lines(move.deletions)} to ${lines(move.additions)}`,
    description: fileName,
    comparison: movedComparison(meta, move, comparisonMethod, fileName),
    fileName,
  });
}

function lines({ start, count }: MovedBlock['deletions']): string {
  return count === 1 ? `line ${start}` : `lines ${start}–${start + count - 1}`;
}
