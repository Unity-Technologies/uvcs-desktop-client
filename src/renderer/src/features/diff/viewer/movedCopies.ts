import type { DisplayMeta } from './changeBlocks';
import type { MovedBlock } from './movedBlocks';

/** The text of a move's two places, as the diff has them (line breaks and all): what comparing them diffs. */
export function movedCopies(meta: DisplayMeta, { deletions, additions }: MovedBlock): { original: string; modified: string } {
  return {
    original: meta.deletionLines.slice(deletions.start - 1, deletions.start - 1 + deletions.count).join(''),
    modified: meta.additionLines.slice(additions.start - 1, additions.start - 1 + additions.count).join(''),
  };
}
