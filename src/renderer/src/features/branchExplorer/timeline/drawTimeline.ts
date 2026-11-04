import type { GraphPalette } from '../canvas/graphPalette';
import { strokeHouse } from '../canvas/houseGlyph';
import { shareHeight, type ActivityCurve } from './activityCurve';
import { frameShape, type TimelineFrame } from './timelineFrame';
import {
  AXIS_TEXT_MIDDLE,
  BASELINE,
  HIT_TICK_HEIGHT,
  LABEL_TICK_HEIGHT,
  MERGED_LABEL_TICK_HEIGHT,
  PLOT_HEIGHT,
  PLOT_TOP,
  TIMELINE_HEIGHT,
} from './timelineGeometry';
import type { HitTick, LabelTick, TimelineGap } from './timelineMarks';
import { HOUSE_RADIUS, PENDING_RING_RADIUS, type Point } from './timelineTargets';

/** Everything one frame of the Timeline draws, already placed in strip px (`GraphTimeline` measures it). */
export interface TimelineDrawing {
  width: number;
  palette: GraphPalette;
  curve: ActivityCurve;
  frame: TimelineFrame;
  /** Where a click would take the frame, while the pointer is on an empty spot. */
  ghost: TimelineFrame | null;
  axisLabels: readonly { x: number; text: string }[];
  labels: readonly LabelTick[];
  gaps: readonly TimelineGap[];
  hits: readonly HitTick[];
  home: Point | null;
  /** The house pinned at the left edge: the workspace is older than everything loaded. */
  homeOlderThanRange: boolean;
  pending: Point | null;
  newestMainX: number | null;
  selectedChangesetX: number | null;
  selectedBranch: { left: number; right: number; color: string } | null;
}

const CURVE_FILL_ALPHA = 0.16;
const CURVE_LINE_ALPHA = 0.55;
const SHARE_ALPHA = 0.6;
const BRANCH_BAND_ALPHA = 0.14;
const AXIS_FONT_SIZE = 10;

export function drawTimeline(ctx: CanvasRenderingContext2D, drawing: TimelineDrawing, pixelRatio: number): void {
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const { width, palette } = drawing;
  ctx.fillStyle = palette.panel;
  ctx.fillRect(0, 0, width, TIMELINE_HEIGHT);
  ctx.fillStyle = palette.border;
  ctx.fillRect(0, TIMELINE_HEIGHT - 1, width, 1);

  drawSelectedBranch(ctx, drawing);
  drawCurve(ctx, drawing);
  drawGaps(ctx, drawing);
  drawLabelTicks(ctx, drawing);
  drawAxisLabels(ctx, drawing);
  drawHitTicks(ctx, drawing);
  drawNewestMain(ctx, drawing);
  drawSelectedChangeset(ctx, drawing);
  if (drawing.ghost) drawFrameOutline(ctx, drawing.ghost, palette, true);
  drawFrameTint(ctx, drawing);
  // Over the frame's tint, under its outline: at the newest end, where the frame often is, the house stays whole and
  // the frame's line runs unbroken.
  drawHome(ctx, drawing);
  drawFrame(ctx, drawing);
}

function drawSelectedBranch(ctx: CanvasRenderingContext2D, { selectedBranch }: TimelineDrawing): void {
  if (!selectedBranch) return;
  const width = Math.max(2, selectedBranch.right - selectedBranch.left);
  ctx.save();
  ctx.fillStyle = selectedBranch.color;
  ctx.globalAlpha = BRANCH_BAND_ALPHA;
  ctx.fillRect(selectedBranch.left, PLOT_TOP, width, PLOT_HEIGHT);
  ctx.globalAlpha = 1;
  ctx.fillRect(selectedBranch.left, BASELINE - 1, width, 2);
  ctx.restore();
}

function drawCurve(ctx: CanvasRenderingContext2D, { curve, palette }: TimelineDrawing): void {
  const { total } = curve;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, BASELINE);
  for (let pixel = 0; pixel < total.length; pixel++) ctx.lineTo(pixel + 0.5, BASELINE - total[pixel]! * PLOT_HEIGHT);
  ctx.lineTo(total.length, BASELINE);
  ctx.closePath();
  ctx.fillStyle = palette.textTertiary;
  ctx.globalAlpha = CURVE_FILL_ALPHA;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, BASELINE);
  for (let pixel = 0; pixel < total.length; pixel++) ctx.lineTo(pixel + 0.5, BASELINE - total[pixel]! * PLOT_HEIGHT);
  ctx.strokeStyle = palette.textTertiary;
  ctx.globalAlpha = CURVE_LINE_ALPHA;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, BASELINE);
  for (let pixel = 0; pixel < total.length; pixel++) ctx.lineTo(pixel + 0.5, BASELINE - shareHeight(curve, pixel, PLOT_HEIGHT));
  ctx.lineTo(total.length, BASELINE);
  ctx.closePath();
  ctx.fillStyle = palette.accent;
  ctx.globalAlpha = SHARE_ALPHA;
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.border;
  ctx.fillRect(0, BASELINE, total.length, 1);
  ctx.restore();
}

/** A break mark (two short slanted strokes across the baseline) where days passed without a changeset. */
function drawGaps(ctx: CanvasRenderingContext2D, { gaps, palette }: TimelineDrawing): void {
  ctx.save();
  ctx.strokeStyle = palette.textTertiary;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  for (const { x } of gaps) {
    ctx.fillStyle = palette.panel;
    ctx.fillRect(x - 3, BASELINE - 5, 6, 10);
    ctx.beginPath();
    for (const offset of [-2, 2]) {
      ctx.moveTo(x + offset - 2, BASELINE + 4);
      ctx.lineTo(x + offset + 2, BASELINE - 4);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawLabelTicks(ctx: CanvasRenderingContext2D, { labels, palette }: TimelineDrawing): void {
  ctx.save();
  ctx.fillStyle = palette.labelText;
  for (const tick of labels) {
    const height = tick.labels.length > 1 ? MERGED_LABEL_TICK_HEIGHT : LABEL_TICK_HEIGHT;
    ctx.fillRect(Math.round(tick.x - 0.5), BASELINE + 1, 1, height);
  }
  ctx.restore();
}

function axisFont(palette: GraphPalette): string {
  return `400 ${AXIS_FONT_SIZE}px ${palette.fontUi}`;
}

let measuringContext: CanvasRenderingContext2D | null = null;

/** How wide an axis date is drawn, so the strip leaves out the dates that would run into each other. */
export function measureAxisText(text: string, palette: GraphPalette): number {
  measuringContext ??= document.createElement('canvas').getContext('2d');
  if (!measuringContext) return text.length * AXIS_FONT_SIZE * 0.6;
  measuringContext.font = axisFont(palette);
  return measuringContext.measureText(text).width;
}

/** The dates `spacedAxisLabels` kept, where it placed them. */
function drawAxisLabels(ctx: CanvasRenderingContext2D, { axisLabels, palette }: TimelineDrawing): void {
  ctx.save();
  ctx.font = axisFont(palette);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = palette.textTertiary;
  for (const { x, text } of axisLabels) ctx.fillText(text, x, AXIS_TEXT_MIDDLE);
  ctx.restore();
}

function drawHitTicks(ctx: CanvasRenderingContext2D, { hits, palette }: TimelineDrawing): void {
  ctx.save();
  ctx.fillStyle = palette.searchHit;
  for (const { x, count } of hits) {
    // Many hits in one pixel stand out more: hundreds read as a density.
    ctx.globalAlpha = Math.min(1, 0.55 + 0.15 * count);
    ctx.fillRect(Math.floor(x), 0, 1, HIT_TICK_HEIGHT);
  }
  ctx.restore();
}

function drawNewestMain(ctx: CanvasRenderingContext2D, { newestMainX, palette }: TimelineDrawing): void {
  if (newestMainX === null) return;
  ctx.save();
  ctx.fillStyle = palette.textSecondary;
  ctx.strokeStyle = palette.panel;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(newestMainX, BASELINE - 3.5);
  ctx.lineTo(newestMainX + 3.5, BASELINE);
  ctx.lineTo(newestMainX, BASELINE + 3.5);
  ctx.lineTo(newestMainX - 3.5, BASELINE);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawSelectedChangeset(ctx: CanvasRenderingContext2D, { selectedChangesetX: x, palette }: TimelineDrawing): void {
  if (x === null) return;
  ctx.save();
  ctx.fillStyle = palette.accent;
  ctx.fillRect(Math.round(x - 0.5), PLOT_TOP + 3, 1, BASELINE - PLOT_TOP - 3);
  ctx.beginPath();
  ctx.arc(x, PLOT_TOP + 3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHome(ctx: CanvasRenderingContext2D, { home, homeOlderThanRange, pending, palette }: TimelineDrawing): void {
  ctx.save();
  if (pending) {
    ctx.fillStyle = palette.panel;
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.arc(pending.x, pending.y, PENDING_RING_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (home) {
    ctx.fillStyle = palette.panel;
    ctx.beginPath();
    ctx.arc(home.x, home.y, HOUSE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    strokeHouse(ctx, home.x, home.y, 0.8, palette.accent, 1.5);
    if (homeOlderThanRange) {
      ctx.font = `600 12px ${palette.fontUi}`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      ctx.fillStyle = palette.accentText;
      ctx.fillText('‹', home.x - 8, home.y);
    }
  }
  ctx.restore();
}

/** The frame's light tint, under what it covers; a frame thinner than a line has none. */
function drawFrameTint(ctx: CanvasRenderingContext2D, { frame, palette }: TimelineDrawing): void {
  if (frameShape(frame) === 'line') return;
  ctx.save();
  ctx.fillStyle = palette.accentSoft;
  ctx.fillRect(frame.left, 0, frame.right - frame.left, TIMELINE_HEIGHT - 1);
  ctx.restore();
}

/** The frame's outline (or line and handle) and its edges' handles. */
function drawFrame(ctx: CanvasRenderingContext2D, { frame, palette }: TimelineDrawing): void {
  const shape = frameShape(frame);
  if (shape === 'line') {
    const x = (frame.left + frame.right) / 2;
    ctx.save();
    ctx.fillStyle = palette.accent;
    ctx.fillRect(Math.round(x) - 1, 1, 2, TIMELINE_HEIGHT - 2);
    // A handle to take hold of a frame thinner than a line.
    roundedRect(ctx, x - 3.5, BASELINE - 6, 7, 12, 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  drawFrameOutline(ctx, frame, palette, false);
  if (shape !== 'boxWithEdges') return;
  ctx.save();
  ctx.fillStyle = palette.accent;
  for (const x of [frame.left, frame.right]) {
    roundedRect(ctx, x - 2, TIMELINE_HEIGHT / 2 - 7, 4, 14, 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFrameOutline(ctx: CanvasRenderingContext2D, frame: TimelineFrame, palette: GraphPalette, ghost: boolean): void {
  ctx.save();
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = ghost ? 1 : 1.5;
  if (ghost) {
    ctx.setLineDash([3, 3]);
    ctx.globalAlpha = 0.7;
  }
  const width = Math.max(1, frame.right - frame.left);
  ctx.strokeRect(frame.left, 0.75, width, TIMELINE_HEIGHT - 2.5);
  ctx.restore();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}
