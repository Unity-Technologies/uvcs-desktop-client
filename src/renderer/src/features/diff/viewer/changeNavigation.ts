import { formatCount, pluralize } from '../../../lib/text';
import type { ChangeBlock, ChangeRegion, DiffSide } from './changeBlocks';

/**
 * Moving from change to change in a text diff (⌥↓ ⌥↑, F7 ⇧F7, the header's arrows). A change is a region of the diff
 * (`listChangeRegions`): changed lines with no unchanged line between them, what a discard's chip acts on.
 */
export interface ChangePosition {
  /** How many changes the diff has. */
  count: number;
  /** The change moved to last, by index; none before the first move or once the changes are others. */
  current: number | null;
  /** How many changes start above the line at the top of the view: where the first move goes from. */
  above: number;
}

/** The change to move to from `position`, down (1) or up (-1); none past the first or last. */
export function adjacentChange({ count, current, above }: ChangePosition, direction: 1 | -1): number | null {
  const target = current === null ? (direction === 1 ? above : above - 1) : current + direction;
  return target >= 0 && target < count ? target : null;
}

/** How many of the changes start above `line` of the modified file. */
export function changesAbove(regions: ChangeRegion[], line: number): number {
  const index = regions.findIndex((region) => region.newStart >= line);
  return index === -1 ? regions.length : index;
}

/**
 * The line of the modified file a row of the diff stands at: an added or unchanged line's own number, a removed line
 * where it was (the modified line after it), from the original's numbering.
 */
export function modifiedLineAt(blocks: ChangeBlock[], side: DiffSide, lineNumber: number): number {
  if (side === 'additions') return lineNumber;
  let shift = 0;
  for (const block of blocks) {
    if (lineNumber < block.oldStart) break;
    if (lineNumber < block.oldStart + block.oldLines) return block.newStart;
    shift = block.newStart + block.newLines - (block.oldStart + block.oldLines);
  }
  return lineNumber + shift;
}

/**
 * The change still current once the text changed: the same one while the diff has as many changes (typing within
 * one), none once changes came or went, and the next move goes from the view again.
 */
export function currentAfterChange(current: number | null, before: ChangeRegion[], after: ChangeRegion[]): number | null {
  return current !== null && before.length === after.length ? current : null;
}

/** "3 of 12" once a change was moved to, "12 changes" before. */
export function changePositionLabel({ count, current }: Pick<ChangePosition, 'count' | 'current'>): string {
  return current === null ? pluralize(count, 'change') : `${formatCount(current + 1)} of ${formatCount(count)}`;
}
