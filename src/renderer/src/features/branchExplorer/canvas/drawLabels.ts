import { GHOST_ALPHA, type DrawContext } from './drawContext';
import { drawRectCorona, drawRectGlow } from './drawSearchHit';
import { textWidth } from './fitText';
import { columnX } from './geometry';
import { LABEL_HEIGHT, labelChips, labelWidth } from './labelPlacement';

const CHIP_RADIUS = 4;

/**
 * Label chips above the labeled changesets that are on screen: an opaque base (lines never show through the name),
 * the label tint and a thin border. While searching, labels without a hit fade their ink; hits glow, and so does a
 * chip counting a hit among the labels that didn't fit.
 */
export function drawLabels(draw: DrawContext): void {
  const { ctx, scene, visible } = draw;
  const { layout, palette, search } = scene;
  const lastColumn = Math.min(visible.lastColumn, layout.nodesByColumn.length - 1);

  ctx.save();
  ctx.font = palette.fonts.label;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 1;
  for (let column = Math.max(0, visible.firstColumn); column <= lastColumn; column++) {
    const node = layout.nodesByColumn[column]!;
    if (!layout.labelsByChangeset.has(node.changeset.id)) continue;

    const x = columnX(node.column);
    for (const { label, more, text, top } of labelChips(layout, node)) {
      const names = [label, ...more].map(({ name }) => name);
      const width = labelWidth(textWidth(ctx, text));
      const left = x - width / 2;
      const hit = names.some((name) => search?.labels.has(name));
      const active = search?.active;
      const current = hit && active?.kind === 'label' && names.includes(active.name);
      if (hit) drawRectGlow(draw, left, top, width, LABEL_HEIGHT, CHIP_RADIUS, current);

      const ink = search && !hit ? GHOST_ALPHA : 1;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.roundRect(left, top, width, LABEL_HEIGHT, CHIP_RADIUS);
      ctx.fillStyle = palette.surfaceRaised;
      ctx.fill();
      ctx.globalAlpha = ink;
      ctx.fillStyle = palette.labelBackground;
      ctx.fill();
      ctx.strokeStyle = palette.labelText;
      ctx.globalAlpha = ink * 0.5;
      ctx.stroke();
      ctx.globalAlpha = ink;
      ctx.fillStyle = palette.labelText;
      ctx.fillText(text, x, top + LABEL_HEIGHT / 2 + 0.5);
      if (current) drawRectCorona(draw, left, top, width, LABEL_HEIGHT, CHIP_RADIUS);
    }
  }
  ctx.restore();
}
