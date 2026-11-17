import { formatCount } from '../../../lib/text';
import type { ChangeBlock, ChangeRegion, DiffSide } from './changeBlocks';
import type { Arrival } from './fileSteps';

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

/** Where a move goes: to a step of this view (a change, a conflict), on to the file beside it in the list, or nowhere. */
export type ChangeMove = { to: 'step'; index: number } | { to: 'file' } | null;

/**
 * Where a move from `position` goes: the next or previous change, else, past the last or first, the file after or
 * before it in the list beside the diff (`canStepFile`), where it opens at its first or last change.
 */
export function plannedMove(position: ChangePosition, direction: 1 | -1, canStepFile: boolean): ChangeMove {
  const index = adjacentChange(position, direction);
  if (index !== null) return { to: 'step', index };
  return canStepFile ? { to: 'file' } : null;
}

/** The change a diff opened by a step from the file beside it moves to: its first going down, its last going up. */
export function arrivalChange(arrival: Arrival, count: number): number | null {
  if (count === 0) return null;
  return arrival === 'first' ? 0 : count - 1;
}

/**
 * Where a view opens: at the step `index`, current ("1 of 12") either way; lit when stepped to from the file beside it,
 * only brought into view otherwise, so a file just picked doesn't flash at the user.
 */
export interface Opening {
  index: number;
  lights: boolean;
}

/**
 * Where a view opens (`useStepNavigation`): stepped to from the file beside it, at its first or last step, lit; opened
 * any other way (picked in a list, from a link, on a page), at its first step, brought into view, so the first move
 * down goes to the second. None without steps, nor on a link's lines (`opensOnLines`), which it stays on, at no step,
 * unless stepped to.
 */
export function openingStep(arrival: Arrival | null, count: number, opensOnLines: boolean): Opening | null {
  if (count === 0) return null;
  if (arrival) return { index: arrivalChange(arrival, count)!, lights: true };
  return opensOnLines ? null : { index: 0, lights: false };
}

/**
 * The step current once a view opened (`openingStep`): the one it opened at, unless the view can only light a step,
 * not just bring it into view (`StepView.show`: a merged file's conflicts), which then opens where it is, at none.
 */
export function currentAtOpening(opening: Opening | null, canShow: boolean): number | null {
  return opening && (opening.lights || canShow) ? opening.index : null;
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
export function currentAfterChange(current: number | null, before: readonly unknown[], after: readonly unknown[]): number | null {
  return current !== null && before.length === after.length ? current : null;
}

/**
 * "3 of 12" while a change (or a conflict) is current, and nothing otherwise: one form only. How many there are is the
 * line counts' and the arrows' tips' to say, and that there are none, the diff's own (identical, binary).
 */
export function positionLabel({ count, current }: Pick<ChangePosition, 'count' | 'current'>): string {
  return current === null || count === 0 ? '' : `${formatCount(current + 1)} of ${formatCount(count)}`;
}
