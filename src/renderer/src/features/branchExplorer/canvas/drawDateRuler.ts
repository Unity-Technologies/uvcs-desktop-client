import type { DrawContext } from './drawContext';
import { COLUMN_WIDTH, columnX } from './geometry';

const RULER_HEIGHT = 28;
/** Minimum screen distance between two date marks, so they never overlap. */
const MIN_MARK_SPACING = 90;

const dayFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const dayWithYearFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

interface DayMark {
  /** Screen x where the day starts. */
  x: number;
  day: string;
}

/**
 * Where each day starts along the visible columns, in screen coordinates. Days closer than
 * the minimum spacing are skipped; the leftmost visible day stays pinned to the left edge.
 */
function dayMarks({ scene, visible }: DrawContext): DayMark[] {
  const { layout, viewport } = scene;
  const marks: DayMark[] = [];
  let previousDay = '';
  const lastColumn = Math.min(visible.lastColumn, layout.nodesByColumn.length - 1);

  for (let column = visible.firstColumn; column <= lastColumn; column++) {
    const day = layout.nodesByColumn[column]!.changeset.date.slice(0, 10);
    if (day === previousDay) continue;
    previousDay = day;

    // Days start halfway between the last changeset of the previous day and the first of this one.
    const x = Math.max(0, (columnX(column) - COLUMN_WIDTH / 2) * viewport.zoom + viewport.panX);
    const last = marks.at(-1);
    if (last && x - last.x < MIN_MARK_SPACING) continue;
    marks.push({ x, day });
  }
  return marks;
}

/** Faint vertical lines where days start, behind everything else. */
export function drawDaySeparators(draw: DrawContext): void {
  const { ctx, scene } = draw;
  ctx.save();
  ctx.fillStyle = scene.palette.gridLine;
  for (const mark of dayMarks(draw)) {
    if (mark.x > 0) ctx.fillRect(Math.round(mark.x), RULER_HEIGHT, 1, scene.size.height - RULER_HEIGHT);
  }
  ctx.restore();
}

/** The sticky ruler at the top with the date of each day. */
export function drawDateRuler(draw: DrawContext): void {
  const { ctx, scene } = draw;
  const { palette, size } = scene;
  const thisYear = String(new Date().getFullYear());

  ctx.save();
  ctx.fillStyle = palette.background;
  ctx.globalAlpha = 0.94;
  ctx.fillRect(0, 0, size.width, RULER_HEIGHT);
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.gridLine;
  ctx.fillRect(0, RULER_HEIGHT, size.width, 1);

  ctx.font = `500 11px ${palette.fontUi}`;
  ctx.textBaseline = 'middle';
  for (const mark of dayMarks(draw)) {
    // Local noon, so the day never shifts when converted from the changeset's own time zone.
    const date = new Date(`${mark.day}T12:00:00`);
    const formatter = mark.day.startsWith(thisYear) ? dayFormatter : dayWithYearFormatter;
    ctx.fillStyle = palette.gridLine;
    ctx.fillRect(Math.round(mark.x), 6, 1, RULER_HEIGHT - 6);
    ctx.fillStyle = palette.textTertiary;
    ctx.fillText(formatter.format(date), mark.x + 7, RULER_HEIGHT / 2 + 1);
  }
  ctx.restore();
}
