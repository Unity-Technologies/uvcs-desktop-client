/**
 * The "More actions" button (⋯) that shows a branch's or a changeset's menu without a right-click: the graph's way to
 * say its objects have actions. It opens the same menu as the right-click and the menu key (`graphMenu`).
 */
import type { GraphLayout } from '../model/layoutGraph';
import type { DrawnTargets, GraphScene } from './drawContext';
import type { DrawnBox } from './drawnBoxes';
import type { Point } from './curves';
import { nodePoint } from './geometry';
import type { GraphTarget } from './graphTargets';

/** A rectangle in world px. */
export type Box = Pick<DrawnBox<unknown>, 'x' | 'y' | 'width' | 'height'>;

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
 * one on every hover; selecting one is how the user says it is the one they are looking at. A selected label leads
 * with its changeset, but its menu is the label's: its changeset shows none, which would open the changeset's instead.
 */
export function changesetWithActions({ selectedChangeset, leadLabel }: Pick<GraphScene, 'selectedChangeset' | 'leadLabel'>): number | null {
  return leadLabel === null ? selectedChangeset : null;
}

/** Where a branch's button goes: just past the right end of its header card, centered on it, pinned with it. */
export function branchActionsCenter(card: Box): Point {
  return { x: card.x + card.width + BRANCH_GAP + ACTIONS_BUTTON_RADIUS, y: card.y + card.height / 2 };
}

/**
 * Where the pointer finds a branch's button: the button, and the gap between it and the card, as tall as the card,
 * whose bottom sits on the band. Moving from anywhere on the card's edge or from the band onto the button never
 * crosses empty space, which would leave the branch, and its button with it, before the pointer gets there. The card
 * is never shorter than the button, so the box holds all of it.
 */
export function branchActionsHitBox(card: Box): Box {
  const left = card.x + card.width;
  return { x: left, y: card.y, width: branchActionsCenter(card).x + ACTIONS_BUTTON_RADIUS - left, height: card.height };
}

/** Where the pointer finds a changeset's button: the button itself. */
export function changesetActionsHitBox(center: Point): Box {
  return { x: center.x - ACTIONS_BUTTON_RADIUS, y: center.y - ACTIONS_BUTTON_RADIUS, width: ACTIONS_BUTTON_RADIUS * 2, height: ACTIONS_BUTTON_RADIUS * 2 };
}

/** Where a changeset's button goes: to the right of it, on its branch's line, before the next column's changeset. */
export function changesetActionsCenter(changeset: Point): Point {
  return { x: changeset.x + CHANGESET_OFFSET, y: changeset.y };
}

/** Names a button, so the frame lights the one under the pointer. */
export function actionsKey(subject: ActionsSubject): string {
  return subject.kind === 'branch' ? `branch:${subject.lane.branch.name}` : `changeset:${subject.id}`;
}

/** Where a button's menu opens, in world px: under the button, from its left edge, as a dropdown opens under its button. */
export function actionsMenuPoint(center: Point): Point {
  return { x: center.x - ACTIONS_BUTTON_RADIUS, y: center.y + ACTIONS_BUTTON_RADIUS };
}

/**
 * Where a subject's button is drawn this frame: beside its branch's card where the last frame drew it, or beside its
 * changeset unless it is collapsed into "+N". None when the card isn't drawn or the changeset isn't laid out.
 */
export function actionsButtonCenter(subject: ActionsSubject, layout: GraphLayout, drawn: Pick<DrawnTargets, 'branchHeaders'>): Point | null {
  if (subject.kind === 'branch') {
    // By name: a lane laid out again between the frame and the click is the same branch.
    const card = drawn.branchHeaders.find((lane) => lane.branch.name === subject.lane.branch.name);
    return card && branchActionsCenter(card);
  }
  const point = nodePoint(layout, subject.id);
  return point && !layout.nodes.get(subject.id)?.collapsed ? changesetActionsCenter(point) : null;
}
