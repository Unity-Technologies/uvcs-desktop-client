import type { DrawContext } from './drawContext';
import { textWidth } from './fitText';
import { COLUMN_WIDTH, columnX } from './geometry';
import { rulerLabelX } from './rulerLabel';

const RULER_HEIGHT = 26;
/**
 * Minimum screen width of a date column. Zoomed out, days narrower than this merge into the column of the day
 * before, so the ruler never turns into slivers of cut dates and the canvas into a wash of lines.
 */
const MIN_COLUMN_WIDTH = 76;
/** The column lines are the ruler's border color, faint. */
const SEPARATOR_ALPHA = 0.45;

interface DayMark {
  /** Screen x where the day starts. */
  x: number;
  day: string;
}

const dayLabels = new Map<string, string>();

/** The day in the user's short date format ("9/22/2026"). */
function dayLabel(day: string): string {
  let label = dayLabels.get(day);
  // Local noon, so the day never shifts when converted from the changeset's own time zone.
  if (label === undefined) dayLabels.set(day, (label = new Date(`${day}T12:00:00`).toLocaleDateString()));
  return label;
}

/** The marks of the current frame, reused from frame to frame. */
const marks: DayMark[] = [];
let markCount = 0;

/**
 * Where each date column starts along the visible changesets, in screen coordinates: one per day, halfway between
 * the last changeset of the day before and the first of the day. Computed once per frame, before anything draws.
 */
export function measureDayMarks({ scene, visible }: DrawContext): void {
  const { layout, viewport } = scene;
  markCount = 0;
  let previousDay = '';
  const lastColumn = Math.min(visible.lastColumn, layout.nodesByColumn.length - 1);

  for (let column = Math.max(0, visible.firstColumn); column <= lastColumn; column++) {
    const day = layout.nodesByColumn[column]!.changeset.date.slice(0, 10);
    if (day === previousDay) continue;
    previousDay = day;

    // Days start halfway between the last changeset of the previous day and the first of this one.
    const x = (columnX(column) - COLUMN_WIDTH / 2) * viewport.zoom + viewport.panX;
    const last = markCount > 0 ? marks[markCount - 1]! : null;
    if (last && x - Math.max(0, last.x) < MIN_COLUMN_WIDTH) continue;
    const mark = marks[markCount] ?? (marks[markCount] = { x: 0, day: '' });
    mark.x = x;
    mark.day = day;
    markCount++;
  }
}

/** Faint lines between the date columns, down the whole canvas, behind everything else. */
export function drawDaySeparators({ ctx, scene }: DrawContext): void {
  ctx.save();
  ctx.fillStyle = scene.palette.border;
  ctx.globalAlpha = SEPARATOR_ALPHA;
  for (let index = 0; index < markCount; index++) {
    const { x } = marks[index]!;
    if (x > 0) ctx.fillRect(Math.round(x), RULER_HEIGHT, 1, scene.size.height - RULER_HEIGHT);
  }
  ctx.restore();
}

/**
 * The sticky ruler at the top with the date of each column. Each date is centered in what is visible of its column,
 * so it stays readable while the column scrolls away, and never crosses into the next one.
 */
export function drawDateRuler({ ctx, scene }: DrawContext): void {
  const { palette, size } = scene;

  ctx.save();
  ctx.fillStyle = palette.panel;
  ctx.fillRect(0, 0, size.width, RULER_HEIGHT);
  ctx.fillStyle = palette.border;
  ctx.fillRect(0, RULER_HEIGHT - 1, size.width, 1);

  ctx.font = palette.fonts.ruler;
  ctx.textBaseline = 'middle';
  for (let index = 0; index < markCount; index++) {
    const mark = marks[index]!;
    const next = index + 1 < markCount ? marks[index + 1]!.x : size.width;
    if (next < 6 || mark.x > size.width) continue;
    if (mark.x >= 0) {
      ctx.fillStyle = palette.border;
      ctx.fillRect(Math.round(mark.x), 4, 1, RULER_HEIGHT - 8);
    }
    const label = dayLabel(mark.day);
    const labelX = rulerLabelX(mark.x, next, textWidth(ctx, label), size.width);
    ctx.save();
    ctx.beginPath();
    ctx.rect(Math.max(0, mark.x), 0, Math.max(0, Math.min(next, size.width) - Math.max(0, mark.x)), RULER_HEIGHT);
    ctx.clip();
    ctx.fillStyle = palette.textTertiary;
    ctx.fillText(label, labelX, RULER_HEIGHT / 2 + 0.5);
    ctx.restore();
  }
  ctx.restore();
}
