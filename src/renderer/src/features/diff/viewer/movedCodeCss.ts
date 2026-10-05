import type { ChangedLine, DiffSide } from './changeBlocks';
import type { DiffLayout } from './diffPreferencesStore';
import type { MovedBlock } from './movedBlocks';
import { lineRowSelector, numberCellSelector } from './pierreDom';

/** The room between the two panes, side by side, where the ribbons joining a move's two places go (`MovedCode`). */
export const RIBBON_GAP = 28;

/**
 * CSS for the code a diff shows moved, to go inside the diff's shadow root. The lines that moved as they were take
 * the moved color where they'd take red or green: Pierre derives a changed row's tint, its number and its bar from
 * `--diffs-deletion-base` or `--diffs-addition-base`, so setting it on the row recolors all three. The lines edited on
 * the way keep red and green, so what changed stands out in the moved code. Pierre's word marks are dropped from
 * every moved line: they compare it with a line beside it that it has nothing to do with, not with its other place.
 * The move under the pointer stands out in both places.
 */
export function movedCodeCss(moves: MovedBlock[], hovered: MovedBlock | undefined): string {
  if (moves.length === 0) return '';
  const rules: string[] = [];
  const removed = moves.flatMap((move) => movedAsItWas(move, 'deletions'));
  const added = moves.flatMap((move) => movedAsItWas(move, 'additions'));
  if (removed.length > 0) rules.push(`${rows(removed)}{--diffs-deletion-base:var(--change-moved)}`);
  if (added.length > 0) rules.push(`${rows(added)}{--diffs-addition-base:var(--change-moved)}`);
  const everyLine = moves.flatMap((move) => [...linesOf(move, 'deletions'), ...linesOf(move, 'additions')]);
  rules.push(`${content(everyLine)} [data-diff-span]{background:none}`);
  if (hovered) {
    const both = [...linesOf(hovered, 'deletions'), ...linesOf(hovered, 'additions')];
    rules.push(`${rows(both)}{background-image:linear-gradient(var(--diff-moved-emphasis),var(--diff-moved-emphasis))}`);
  }
  return rules.join('\n');
}

/**
 * CSS making room between the two panes for the ribbons, side by side. It stays while the moves hide (typing), or the
 * modified side's code would shift sideways as typing starts and stops.
 */
export function ribbonRoomCss(layout: DiffLayout): string {
  return layout === 'split' ? `[data-additions] [data-gutter]{margin-inline-start:${RIBBON_GAP}px}` : '';
}

/** Every line of a move's place on one side. */
export function linesOf(move: MovedBlock, side: DiffSide): ChangedLine[] {
  const { start, count } = move[side];
  return Array.from({ length: count }, (_, offset) => ({ side, lineNumber: start + offset }));
}

function movedAsItWas(move: MovedBlock, side: DiffSide): ChangedLine[] {
  const edited = new Set(move.changed.filter((line) => line.side === side).map((line) => line.lineNumber));
  return linesOf(move, side).filter((line) => !edited.has(line.lineNumber));
}

const content = (lines: ChangedLine[]): string => `:is(${lines.map(lineRowSelector).join(',')})`;
const rows = (lines: ChangedLine[]): string => `:is(${[...lines.map(lineRowSelector), ...lines.map(numberCellSelector)].join(',')})`;
