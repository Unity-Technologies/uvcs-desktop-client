import type { ChangedLine, DiffSide } from './changeBlocks';
import type { MovedBlock } from './movedBlocks';
import { lineRowSelector, numberCellSelector } from './pierreDom';

/**
 * CSS for the code a diff shows moved, to go inside the diff's shadow root. Moved code keeps the diff's own red and
 * green, edited lines too, as the official client keeps its own colors: the moved color only marks moves, so the
 * diff's code speaks one language. Its line numbers take the moved color (Pierre derives a number cell's tint, its
 * number and its bar from `--diffs-deletion-base` or `--diffs-addition-base`), so what moved shows at a glance down the
 * edge of the code; so do its labels, its ribbon and the move under the pointer. Pierre's word marks are dropped from
 * every moved line: they compare it with a line beside it that it has nothing to do with, not with its other place;
 * the words it changed are marked against the line it became instead (`useMovedWordMarks`). The move under the
 * pointer stands out in both places.
 */
export function movedCodeCss(moves: MovedBlock[], hovered: MovedBlock | undefined): string {
  if (moves.length === 0) return '';
  const removed = moves.flatMap((move) => linesOf(move, 'deletions'));
  const added = moves.flatMap((move) => linesOf(move, 'additions'));
  const rules = [
    `${numbers(removed)}{--diffs-deletion-base:var(--change-moved)}`,
    `${numbers(added)}{--diffs-addition-base:var(--change-moved)}`,
    `${content([...removed, ...added])} [data-diff-span]{background:none}`,
  ];
  if (hovered) {
    const both = [...linesOf(hovered, 'deletions'), ...linesOf(hovered, 'additions')];
    rules.push(`${rows(both)}{background-image:linear-gradient(var(--diff-moved-emphasis),var(--diff-moved-emphasis))}`);
  }
  return rules.join('\n');
}

/** Every line of a move's place on one side. */
export function linesOf(move: MovedBlock, side: DiffSide): ChangedLine[] {
  const { start, count } = move[side];
  return Array.from({ length: count }, (_, offset) => ({ side, lineNumber: start + offset }));
}

const numbers = (lines: ChangedLine[]): string => `:is(${lines.map(numberCellSelector).join(',')})`;
const content = (lines: ChangedLine[]): string => `:is(${lines.map(lineRowSelector).join(',')})`;
const rows = (lines: ChangedLine[]): string => `:is(${[...lines.map(lineRowSelector), ...lines.map(numberCellSelector)].join(',')})`;
