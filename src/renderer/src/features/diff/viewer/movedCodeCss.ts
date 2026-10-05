import type { ChangedLine, DiffSide } from './changeBlocks';
import type { MovedBlock } from './movedBlocks';
import { lineRowSelector, numberCellSelector } from './pierreDom';

/**
 * CSS for the code a diff shows moved, to go inside the diff's shadow root. Every line of a move takes the moved color
 * where it'd take red or green, so what moved shows at a glance: Pierre derives a changed row's number and bar from
 * `--diffs-deletion-base` or `--diffs-addition-base`, and its tint from them too unless told another color
 * (`--diffs-bg-deletion-override`, `--diffs-bg-deletion-number-override`): the tint is a lighter moved color
 * (`--diff-moved-tint`), so a move is quieter than the changes around it while its numbers and bar stand out. A move reads as one block in one color: the lines changed on the way (edited, or only added or
 * removed inside it) are tinted a little stronger, and their changed words marked stronger still
 * (`useMovedWordMarks`). Pierre's word marks are dropped from every moved line: they compare it with a line beside it
 * that it has nothing to do with, not with its other place. The move under the pointer stands out in both places.
 */
export function movedCodeCss(moves: MovedBlock[], hovered: MovedBlock | undefined): string {
  if (moves.length === 0) return '';
  const removed = moves.flatMap((move) => linesOf(move, 'deletions'));
  const added = moves.flatMap((move) => linesOf(move, 'additions'));
  const rules = [
    `${rows(removed)}{--diffs-deletion-base:var(--change-moved);--diffs-bg-deletion-override:var(--diff-moved-tint);--diffs-bg-deletion-number-override:var(--diff-moved-tint)}`,
    `${rows(added)}{--diffs-addition-base:var(--change-moved);--diffs-bg-addition-override:var(--diff-moved-tint);--diffs-bg-addition-number-override:var(--diff-moved-tint)}`,
    `${content([...removed, ...added])} [data-diff-span]{background:none}`,
  ];
  const edited = moves.flatMap((move) => move.changed);
  if (edited.length > 0) rules.push(`${rows(edited)}{background-image:${EDITED}}`);
  if (hovered) {
    const editedHere = new Set(hovered.changed.map(lineKey));
    const asItWas = [...linesOf(hovered, 'deletions'), ...linesOf(hovered, 'additions')].filter((line) => !editedHere.has(lineKey(line)));
    if (asItWas.length > 0) rules.push(`${rows(asItWas)}{background-image:${EMPHASIS}}`);
    if (hovered.changed.length > 0) rules.push(`${rows(hovered.changed)}{background-image:${EMPHASIS},${EDITED}}`);
  }
  return rules.join('\n');
}

/** Tints over a row's own: a line changed on the way, and the move under the pointer. */
const EDITED = 'linear-gradient(var(--diff-moved-edited),var(--diff-moved-edited))';
const EMPHASIS = 'linear-gradient(var(--diff-moved-emphasis),var(--diff-moved-emphasis))';

const lineKey = ({ side, lineNumber }: ChangedLine): string => `${side}:${lineNumber}`;

/** Every line of a move's place on one side. */
export function linesOf(move: MovedBlock, side: DiffSide): ChangedLine[] {
  const { start, count } = move[side];
  return Array.from({ length: count }, (_, offset) => ({ side, lineNumber: start + offset }));
}

const content = (lines: ChangedLine[]): string => `:is(${lines.map(lineRowSelector).join(',')})`;
const rows = (lines: ChangedLine[]): string => `:is(${[...lines.map(lineRowSelector), ...lines.map(numberCellSelector)].join(',')})`;
