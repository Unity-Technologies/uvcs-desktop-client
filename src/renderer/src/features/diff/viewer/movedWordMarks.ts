import type { DisplayMeta } from './changeBlocks';
import type { MovedBlock } from './movedBlocks';
import { WORD_MARKS } from './pierreOptions';
import { coveredMarks, lineWordMarks, type MarkRange } from './wordMarkRows';

/** The characters to mark in lines of moved code, by line number on each side. */
export interface MovedWordMarks {
  deletions: Map<number, MarkRange[]>;
  additions: Map<number, MarkRange[]>;
}

/**
 * The words each line edited inside moved code changed, against the line it became (`MovedBlock.replaced`), marked as
 * Pierre marks a line against the one beside it (`lineWordMarks`, `WORD_MARKS`). Pierre pairs a moved line with
 * whatever line stands across from it, so its own marks on moved code are dropped (`movedCodeCss`) and these drawn
 * instead (`useMovedWordMarks`), as the official client marks them.
 */
export function movedWordMarks(meta: DisplayMeta, moves: MovedBlock[]): MovedWordMarks {
  const marks: MovedWordMarks = { deletions: new Map(), additions: new Map() };
  for (const { deletion, addition } of moves.flatMap((move) => move.replaced)) {
    const lineMarks = lineWordMarks(meta.deletionLines[deletion - 1] ?? '', meta.additionLines[addition - 1] ?? '', WORD_MARKS.lineDiffType, WORD_MARKS.maxLineDiffLength);
    marks.deletions.set(deletion, coveredMarks(lineMarks.deletion));
    marks.additions.set(addition, coveredMarks(lineMarks.addition));
  }
  return marks;
}
