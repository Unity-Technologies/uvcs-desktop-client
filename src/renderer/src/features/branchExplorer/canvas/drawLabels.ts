import type { DrawContext } from './drawContext';
import { columnX } from './geometry';
import { LABEL_HEIGHT, labelTop, labelWidth } from './labelPlacement';

/** Label pills above the labeled changesets that are on screen. */
export function drawLabels({ ctx, scene, visible }: DrawContext): void {
  const { layout, palette } = scene;
  const lastColumn = Math.min(visible.lastColumn, layout.nodesByColumn.length - 1);

  ctx.save();
  ctx.font = `600 10.5px ${palette.fontUi}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let column = visible.firstColumn; column <= lastColumn; column++) {
    const node = layout.nodesByColumn[column]!;
    const labels = layout.labelsByChangeset.get(node.changeset.id);
    if (!labels) continue;

    const x = columnX(node.column);
    labels.forEach((label, index) => {
      const top = labelTop(layout, node, index);
      const width = labelWidth(ctx.measureText(label.name).width);
      ctx.beginPath();
      ctx.roundRect(x - width / 2, top, width, LABEL_HEIGHT, LABEL_HEIGHT / 2);
      ctx.fillStyle = palette.background;
      ctx.fill();
      ctx.fillStyle = palette.labelBackground;
      ctx.fill();
      ctx.strokeStyle = palette.labelText;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = palette.labelText;
      ctx.fillText(label.name, x, top + LABEL_HEIGHT / 2 + 0.5);
    });
  }
  ctx.restore();
}
