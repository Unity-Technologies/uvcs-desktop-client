import type { DrawContext } from './drawContext';
import { columnX } from './geometry';

const HEADER_HEIGHT = 26;
/** Minimum screen distance between two date marks, so they never overlap. */
const MIN_MARK_SPACING = 84;

const dayFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

/** A sticky band at the top marking where each day starts. Drawn in screen coordinates. */
export function drawDateHeader({ ctx, scene, visible }: DrawContext): void {
  const { layout, viewport, size, palette } = scene;

  ctx.save();
  ctx.fillStyle = palette.background;
  ctx.globalAlpha = 0.92;
  ctx.fillRect(0, 0, size.width, HEADER_HEIGHT);
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.gridLine;
  ctx.fillRect(0, HEADER_HEIGHT, size.width, 1);

  ctx.font = `500 10.5px ${palette.fontUi}`;
  ctx.textBaseline = 'middle';

  let previousDay = '';
  let lastMarkX = Number.NEGATIVE_INFINITY;
  const lastColumn = Math.min(visible.lastColumn, layout.nodesByColumn.length - 1);
  for (let column = visible.firstColumn; column <= lastColumn; column++) {
    const day = layout.nodesByColumn[column]!.changeset.date.slice(0, 10);
    if (day === previousDay) continue;
    previousDay = day;

    // The day of the leftmost changeset stays pinned to the left edge.
    const x = Math.max(8, columnX(column) * viewport.zoom + viewport.panX);
    if (x - lastMarkX < MIN_MARK_SPACING) continue;
    lastMarkX = x;

    ctx.fillStyle = palette.gridLine;
    ctx.fillRect(x, HEADER_HEIGHT - 6, 1, 6);
    ctx.fillStyle = palette.textTertiary;
    // Local noon, so the day never shifts when converted from the changeset's own time zone.
    ctx.fillText(dayFormatter.format(new Date(`${day}T12:00:00`)), x + 4, HEADER_HEIGHT / 2);
  }
  ctx.restore();
}
