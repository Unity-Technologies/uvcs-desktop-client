import type { DrawContext, GraphScene } from './drawContext';

/** The selection: a soft halo behind the changeset and an accent ring just outside its branch ring. */
const SELECTION_HALO = 8;
const SELECTION_RING = 4;

/** The selection's colors: the accent for one thing, magenta for several, so a selection of many never reads as one. */
export function selectionInks({ palette, multipleSelection }: Pick<GraphScene, 'palette' | 'multipleSelection'>): { ring: string; halo: string } {
  return multipleSelection ? { ring: palette.multipleSelection, halo: palette.multipleSelectionSoft } : { ring: palette.accent, halo: palette.accentSoft };
}

/** The halo, drawn behind the changeset. */
export function drawSelectionHalo({ ctx, pen, scene }: DrawContext, x: number, y: number, radius: number): void {
  ctx.save();
  ctx.fillStyle = selectionInks(scene).halo;
  ctx.beginPath();
  pen.arc(x, y, radius + SELECTION_HALO, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The ring, drawn over the changeset. */
export function drawSelectionRing({ ctx, pen, scene, detail }: DrawContext, x: number, y: number, radius: number): void {
  ctx.save();
  ctx.strokeStyle = selectionInks(scene).ring;
  ctx.lineWidth = 2;
  ctx.beginPath();
  pen.arc(x, y, radius + (detail.avatars ? SELECTION_RING + 1 : SELECTION_RING - 1), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
