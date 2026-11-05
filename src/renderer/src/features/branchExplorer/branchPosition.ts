import type { Action } from '../../lib/actions';
import { hotkey, type ShortcutId } from '../../lib/shortcutRegistry';
import { confirm } from '../../ui/dialog/confirm';
import { branchMoves, movedBranch, NO_PINS, withoutPin, type BranchMove, type BranchPins } from './model/branchRows';
import type { GraphLayout, Lane } from './model/layoutGraph';

/** The branches moved in the repository shown, and how to change them (`setPins` in the preferences). */
export interface BranchPositions {
  pins: BranchPins;
  setPins: (pins: BranchPins) => void;
}

/**
 * The branches moved in `repository` and how to change them; null while the repository isn't known yet, since pins
 * are kept per repository: the Position entries are then disabled and the keys move nothing.
 */
export function branchPositionsOf(repository: string | undefined, pins: BranchPins, setPinsOf: (repository: string, pins: BranchPins) => void): BranchPositions | null {
  if (repository === undefined) return null;
  return { pins, setPins: (next) => setPinsOf(repository, next) };
}

/**
 * Each move, its words in the Position submenu and its key in the graph. The words are written here, not taken from
 * `menuWords`: that holds the verbs shared by every object's menu, and these name moves only the Branch Explorer offers.
 */
export const BRANCH_MOVES: readonly { move: BranchMove; label: string; shortcutId: ShortcutId }[] = [
  { move: 'up', label: 'Move up', shortcutId: 'graphMoveBranchUp' },
  { move: 'down', label: 'Move down', shortcutId: 'graphMoveBranchDown' },
  { move: 'top', label: 'Move to the top', shortcutId: 'graphMoveBranchToTop' },
  { move: 'bottom', label: 'Move to the bottom', shortcutId: 'graphMoveBranchToBottom' },
];

/** Moves the lane's branch, when the move changes anything (`branchMoves`). */
export function moveBranch(layout: GraphLayout, lane: Lane, move: BranchMove, { pins, setPins }: BranchPositions): void {
  if (branchMoves(layout, lane, pins)[move]) setPins(movedBranch(pins, lane, move, layout.rowCount));
}

/**
 * The entries of a branch's Position submenu: the moves, then putting it back where the layout puts it, and every
 * branch of the repository back, after asking (the arrangement can't be brought back).
 */
export function branchPositionEntries(layout: GraphLayout, lane: Lane, positions: BranchPositions | null): Action[] {
  if (positions === null) return positionEntriesWithNoRepository();
  const { pins, setPins } = positions;
  const offered = branchMoves(layout, lane, pins);
  return [
    ...BRANCH_MOVES.map(({ move, label, shortcutId }) => ({
      id: `position.${move}`,
      label,
      shortcut: hotkey(shortcutId),
      disabled: !offered[move],
      run: () => moveBranch(layout, lane, move, positions),
    })),
    { id: 'position.reset', label: 'Reset position', disabled: !offered.reset, run: () => setPins(withoutPin(pins, lane.branch.id)) },
    { id: 'position.resetAll', label: 'Reset all positions…', disabled: !offered.resetAll, run: () => void resetAllPositions(setPins) },
  ];
}

function positionEntriesWithNoRepository(): Action[] {
  return [
    ...BRANCH_MOVES.map(({ move, label, shortcutId }) => ({ id: `position.${move}`, label, shortcut: hotkey(shortcutId), disabled: true, run: () => {} })),
    { id: 'position.reset', label: 'Reset position', disabled: true, run: () => {} },
    { id: 'position.resetAll', label: 'Reset all positions…', disabled: true, run: () => {} },
  ];
}

/** Puts every branch of the repository back where the layout puts it, once the user agrees. */
export async function resetAllPositions(setPins: BranchPositions['setPins']): Promise<void> {
  const confirmed = await confirm({
    title: 'Reset all positions?',
    message: 'Every branch moved in this repository goes back where the Branch Explorer places it.',
    confirmLabel: 'Reset',
  });
  if (confirmed) setPins(NO_PINS);
}
