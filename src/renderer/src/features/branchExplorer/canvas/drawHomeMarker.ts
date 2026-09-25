import type { NodeLayout } from '../model/layoutGraph';
import type { DrawContext } from './drawContext';
import { columnX, rowY } from './geometry';

const BADGE_RADIUS = 7.5;

/** Marks the changeset the workspace is on: an accent ring and a small house badge at its top-right. */
export function drawHomeMarker({ ctx, scene }: DrawContext, node: NodeLayout, nodeRadius: number): void {
  const x = columnX(node.column);
  const y = rowY(node.row);
  const { accent, accentContrast, background } = scene.palette;

  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, nodeRadius + 6, 0, Math.PI * 2);
  ctx.stroke();

  const badgeX = x + nodeRadius * 0.8 + 3;
  const badgeY = y - nodeRadius * 0.8 - 3;
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, BADGE_RADIUS + 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, BADGE_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = accentContrast;
  ctx.beginPath();
  ctx.moveTo(badgeX - 4, badgeY);
  ctx.lineTo(badgeX, badgeY - 3.8);
  ctx.lineTo(badgeX + 4, badgeY);
  ctx.lineTo(badgeX + 2.7, badgeY);
  ctx.lineTo(badgeX + 2.7, badgeY + 3.4);
  ctx.lineTo(badgeX - 2.7, badgeY + 3.4);
  ctx.lineTo(badgeX - 2.7, badgeY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
