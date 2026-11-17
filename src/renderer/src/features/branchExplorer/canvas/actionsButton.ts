import type { GraphScene } from './drawContext';
import type { DrawnBox } from './drawnBoxes';
import type { Point } from './curves';
import type { GraphTarget } from './graphTargets';
import type { Viewport } from './viewport';

/**
 * The "More actions" button (⋯) that shows a branch's or a changeset's menu without a right-click: the graph's way to
 * say its objects have actions. It opens the same menu as the right-click and the menu key (`graphMenu`).
 */

/** What a button opens the menu of. */
export type ActionsSubject = Extract<GraphTarget, { kind: 'branch' } | { kind: 'changeset' }>;

/** The button's size in world px: it zooms with the graph, as the header card it sits beside does. */
export const ACTIONS_BUTTON_RADIUS = 9;
/** The room between a branch's header card and its button. */
const BRANCH_GAP = 4;
/** From a changeset's center to its button's: past the selection halo (`drawSelectionHalo`), short of the next column. */
const CHANGESET_OFFSET = 30;

/**
 * The branches that show their button: the one the pointer is on (its header, its band, or the button itself) and the
 * one leading the selection. Every branch showing one would crowd a graph of thousands; these are the branches the
 * user is looking at.
 */
export function branchesWithActions({ hoveredBranch, selectedBranch }: Pick<GraphScene, 'hoveredBranch' | 'selectedBranch'>): string[] {
  const names: string[] = [];
  if (selectedBranch !== null) names.push(selectedBranch);
  if (hoveredBranch !== null && hoveredBranch !== selectedBranch) names.push(hoveredBranch);
  return names;
}

/**
 * The changeset that shows its button: only the one leading the selection. Changesets are too small and too many for
 * one on every hover; selecting one is how the user says it is the one they are looking at.
 */
export function changesetWithActions({ selectedChangeset }: Pick<GraphScene, 'selectedChangeset'>): number | null {
  return selectedChangeset;
}

/** Where a branch's button goes: just past the right end of its header card, centered on it, pinned with it. */
export function branchActionsCenter(card: Pick<DrawnBox<unknown>, 'x' | 'y' | 'width' | 'height'>): Point {
  return { x: card.x + card.width + BRANCH_GAP + ACTIONS_BUTTON_RADIUS, y: card.y + card.height / 2 };
}

/** Where a changeset's button goes: to the right of it, on its branch's line, before the next column's changeset. */
export function changesetActionsCenter(changeset: Point): Point {
  return { x: changeset.x + CHANGESET_OFFSET, y: changeset.y };
}

/** Names a button, so the frame lights the one under the pointer. */
export function actionsKey(subject: ActionsSubject): string {
  return subject.kind === 'branch' ? `branch:${subject.lane.branch.name}` : `changeset:${subject.id}`;
}

/**
 * Where a button's menu opens, in screen px from the canvas' corner: under the button, from its left edge, as a
 * dropdown opens under the button that opened it.
 */
export function actionsMenuPoint(button: Pick<DrawnBox<unknown>, 'x' | 'y' | 'height'>, { zoom, panX, panY }: Viewport): Point {
  return { x: button.x * zoom + panX, y: (button.y + button.height) * zoom + panY };
}
