import {
  ACTIONS_BUTTON_RADIUS,
  actionsButtonCenter,
  actionsKey,
  branchActionsCenter,
  branchActionsHitBox,
  branchesWithActions,
  changesetActionsHitBox,
  changesetWithActions,
  type ActionsSubject,
  type Box,
} from './actionsButton';
import type { DrawContext } from './drawContext';
import type { Point } from './curves';

/** The three dots: their radius and the room between their centers. */
const DOT_RADIUS = 1.4;
const DOT_SPACING = 4;

/**
 * Draws the "More actions" buttons (`actionsButton.ts`) over everything in the world: beside the header card of the
 * branch under the pointer and of the selected branch (where the card was drawn, pinned to the edge or not), and
 * beside the selected changeset while it is drawn in full (`actionsButtonCenter`). Records each for the pointer
 * (`branchActionsHitBox`). Drawn with the text, at zooms where the header cards are.
 */
export function drawActionsButtons(draw: DrawContext): void {
  const { scene, drawn } = draw;
  for (const name of branchesWithActions(scene)) {
    const card = drawn.branchHeaders.find((lane) => lane.branch.name === name);
    if (!card) continue;
    drawButton(draw, { kind: 'branch', lane: card.item }, branchActionsCenter(card), branchActionsHitBox(card));
  }
  const changesetId = changesetWithActions(scene);
  if (changesetId === null) return;
  const subject: ActionsSubject = { kind: 'changeset', id: changesetId };
  const center = actionsButtonCenter(subject, scene.layout, drawn);
  if (center) drawButton(draw, subject, center, changesetActionsHitBox(center));
}

/** A small round button like the lists' icon buttons: the raised surface, a hairline, the dots; tinted in the accent under the pointer. */
function drawButton(draw: DrawContext, subject: ActionsSubject, center: Point, hitBox: Box): void {
  const { ctx, pen, scene, visible } = draw;
  const radius = ACTIONS_BUTTON_RADIUS;
  if (center.x + radius < visible.left || center.x - radius > visible.right || center.y + radius < visible.top || center.y - radius > visible.bottom) return;
  const { palette } = scene;
  const hovered = scene.hoveredActions === actionsKey(subject);

  ctx.save();
  ctx.beginPath();
  pen.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = palette.surfaceRaised;
  ctx.fill();
  if (hovered) {
    ctx.fillStyle = palette.accentSoft;
    ctx.fill();
  }
  ctx.strokeStyle = hovered ? palette.accent : palette.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = hovered ? palette.accent : palette.textSecondary;
  for (const offset of [-DOT_SPACING, 0, DOT_SPACING]) {
    ctx.beginPath();
    pen.arc(center.x + offset, center.y, DOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  draw.drawn.actionButtons.add(subject, hitBox.x, hitBox.y, hitBox.width, hitBox.height);
}
