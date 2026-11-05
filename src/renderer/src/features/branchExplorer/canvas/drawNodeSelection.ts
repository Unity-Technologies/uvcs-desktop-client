import type { DrawContext } from './drawContext';

/** The selection: a soft halo behind the changeset and an accent ring just outside its branch ring. */
const SELECTION_HALO = 8;
const SELECTION_RING = 4;

/** The halo, drawn behind the changeset. */
export function drawSelectionHalo({ ctx, pen, scene }: DrawContext, x: number, y: number, radius: number): void {
  ctx.save();
  ctx.fillStyle = scene.palette.accentSoft;
  ctx.beginPath();
  pen.arc(x, y, radius + SELECTION_HALO, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The ring, drawn over the changeset. */
export function drawSelectionRing({ ctx, pen, scene, detail }: DrawContext, x: number, y: number, radius: number): void {
  ctx.save();
  ctx.strokeStyle = scene.palette.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  pen.arc(x, y, radius + (detail.avatars ? SELECTION_RING + 1 : SELECTION_RING - 1), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
