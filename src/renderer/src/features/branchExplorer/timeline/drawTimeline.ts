import { drawHomeBadge } from '../canvas/drawHomeMarker';
import type { GraphPalette } from '../canvas/graphPalette';
import type { PlacedAxisLabel } from './timelineCalendar';
import type { CurvePath, TimelineCurves } from './timelineCurvePath';
import { frameShape, type TimelineFrame } from './timelineFrame';
import {
  AXIS_LINE_HEIGHT,
  AXIS_TEXT_MIDDLE,
  AXIS_TOP,
  BASELINE,
  FRAME_HEIGHT,
  FRAME_TOP,
  HIT_TICK_HEIGHT,
  HIT_TICK_TOP,
  LABEL_TICK_HEIGHT,
  LABEL_TICK_TOP,
  LABEL_TICK_WIDTH,
  MERGED_LABEL_TICK_HEIGHT,
  MERGED_LABEL_TICK_TOP,
  PLOT_TOP,
  TIMELINE_HEIGHT,
} from './timelineGeometry';
import type { HitTick, LabelTick, TimelineGap } from './timelineMarks';
import { HOUSE_RADIUS, type Point } from './timelineTargets';

/** Everything one frame of the Timeline draws, already placed in strip px (`timelineDrawing`). */
export interface TimelineDrawing {
  width: number;
  palette: GraphPalette;
  curves: TimelineCurves;
  frame: TimelineFrame;
  /** Whether the frame is hovered or dragged: its full halo and its edges' grips. */
  frameActive: boolean;
  /** Where a click would take the frame, while the pointer is on an empty spot. */
  ghost: TimelineFrame | null;
  axisLabels: readonly PlacedAxisLabel[];
  labels: readonly LabelTick[];
  gaps: readonly TimelineGap[];
  hits: readonly HitTick[];
  home: Point | null;
  /** The house stands for pending changes: its ring is dashed. */
  homePending: boolean;
  /** The house pinned at the left edge: the workspace is older than everything loaded. */
  homeOlderThanRange: boolean;
  newestMainX: number | null;
  selectedChangesetX: number | null;
  selectedBranch: { left: number; right: number; color: string } | null;
}

/** The curve's fill, its line and the user's share, as the approved design weighs them. */
const CURVE_FILL_ALPHA = 0.16;
const CURVE_LINE_ALPHA = 0.6;
const CURVE_LINE_WIDTH = 1.25;
const SHARE_ALPHA = 0.5;
const BRANCH_BAND_ALPHA = 0.18;
const AXIS_FONT_SIZE = 10;
const FRAME_RADIUS = 5;
/** The halo around the frame: 3 px, half as strong until the frame is hovered or dragged. */
const HALO_WIDTH = 3;
const RESTING_HALO_ALPHA = 0.5;

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
  drawLabelTicks(ctx, drawing, pixelRatio);
  drawAxisLabels(ctx, drawing, pixelRatio);
  drawHitTicks(ctx, drawing);
  drawNewestMain(ctx, drawing);
  drawSelectedChangeset(ctx, drawing);
  if (drawing.ghost) drawGhostFrame(ctx, drawing.ghost, palette);
  drawFrameBack(ctx, drawing);
  // Over the frame's tint, under its outline: at the newest end, where the frame often is, the house stays whole and
  // the frame's line runs unbroken.
  drawHome(ctx, drawing);
  drawFrame(ctx, drawing);
}

/** Snaps a length to the device's pixels, so a hairline is drawn crisp rather than smeared over two. */
function snap(value: number, pixelRatio: number): number {
  return Math.round(value * pixelRatio) / pixelRatio;
}

function drawSelectedBranch(ctx: CanvasRenderingContext2D, { selectedBranch }: TimelineDrawing): void {
  if (!selectedBranch) return;
  const width = Math.max(3, selectedBranch.right - selectedBranch.left);
  ctx.save();
  ctx.fillStyle = selectedBranch.color;
  ctx.globalAlpha = BRANCH_BAND_ALPHA;
  roundedRect(ctx, selectedBranch.left - 1, PLOT_TOP - 4, width + 2, BASELINE - PLOT_TOP + 2, 4);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = selectedBranch.color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function tracePath(ctx: CanvasRenderingContext2D, { start, segments }: CurvePath): void {
  ctx.moveTo(start.x, start.y);
  for (const { c1, c2, end } of segments) ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
}

/** The path closed down to the baseline, to fill. */
function traceArea(ctx: CanvasRenderingContext2D, path: CurvePath): void {
  ctx.beginPath();
  tracePath(ctx, path);
  const end = path.segments.at(-1)?.end ?? path.start;
  ctx.lineTo(end.x, BASELINE);
  ctx.lineTo(path.start.x, BASELINE);
  ctx.closePath();
}

function drawCurve(ctx: CanvasRenderingContext2D, { curves, palette, width }: TimelineDrawing): void {
  ctx.save();
  traceArea(ctx, curves.total);
  ctx.fillStyle = palette.textTertiary;
  ctx.globalAlpha = CURVE_FILL_ALPHA;
  ctx.fill();

  traceArea(ctx, curves.share);
  ctx.fillStyle = palette.accent;
  ctx.globalAlpha = SHARE_ALPHA;
  ctx.fill();

  ctx.beginPath();
  tracePath(ctx, curves.total);
  ctx.strokeStyle = palette.textTertiary;
  ctx.globalAlpha = CURVE_LINE_ALPHA;
  ctx.lineWidth = CURVE_LINE_WIDTH;
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.border;
  ctx.fillRect(0, BASELINE, width, 1);
  ctx.restore();
}

/** A break mark where days passed without a changeset: a small slanted box across the baseline, its sides drawn. */
function drawGaps(ctx: CanvasRenderingContext2D, { gaps, palette }: TimelineDrawing): void {
  const half = { width: 2.5, height: 6 };
  // skewX(-18deg): the top leans right, the bottom left.
  const lean = Math.tan((18 * Math.PI) / 180) * half.height;
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = palette.textTertiary;
  ctx.fillStyle = palette.panel;
  for (const { x } of gaps) {
    const top = BASELINE - half.height;
    const bottom = BASELINE + half.height;
    ctx.beginPath();
    ctx.moveTo(x - half.width + lean, top);
    ctx.lineTo(x + half.width + lean, top);
    ctx.lineTo(x + half.width - lean, bottom);
    ctx.lineTo(x - half.width - lean, bottom);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - half.width + lean + 0.75, top);
    ctx.lineTo(x - half.width - lean + 0.75, bottom);
    ctx.moveTo(x + half.width + lean - 0.75, top);
    ctx.lineTo(x + half.width - lean - 0.75, bottom);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * One tick per label (or group) under the baseline, in the label color at full strength (3:1 on the strip), snapped to
 * the device's pixels so it reads crisp.
 */
function drawLabelTicks(ctx: CanvasRenderingContext2D, { labels, palette }: TimelineDrawing, pixelRatio: number): void {
  ctx.save();
  ctx.fillStyle = palette.labelMark;
  const width = Math.max(1, snap(LABEL_TICK_WIDTH, pixelRatio));
  for (const tick of labels) {
    const merged = tick.labels.length > 1;
    const left = snap(tick.x - width / 2, pixelRatio);
    ctx.fillRect(left, merged ? MERGED_LABEL_TICK_TOP : LABEL_TICK_TOP, width, merged ? MERGED_LABEL_TICK_HEIGHT : LABEL_TICK_HEIGHT);
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

/** The dates `spacedAxisLabels` kept, where it placed them: a hairline where each begins, the date 4 px after it. */
function drawAxisLabels(ctx: CanvasRenderingContext2D, { axisLabels, palette }: TimelineDrawing, pixelRatio: number): void {
  ctx.save();
  ctx.fillStyle = palette.border;
  for (const { lineX } of axisLabels) if (lineX !== null) ctx.fillRect(snap(lineX, pixelRatio), AXIS_TOP, 1, AXIS_LINE_HEIGHT);
  ctx.font = axisFont(palette);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = palette.textTertiary;
  for (const { x, text } of axisLabels) ctx.fillText(text, snap(x, pixelRatio), snap(AXIS_TEXT_MIDDLE, pixelRatio));
  ctx.restore();
}

function drawHitTicks(ctx: CanvasRenderingContext2D, { hits, palette }: TimelineDrawing): void {
  ctx.save();
  ctx.fillStyle = palette.searchHit;
  for (const { x, count } of hits) {
    // Many hits in one pixel stand out more: hundreds read as a density.
    ctx.globalAlpha = Math.min(1, 0.6 + 0.15 * count);
    roundedRect(ctx, x - 1, HIT_TICK_TOP, 2, HIT_TICK_HEIGHT, 1);
    ctx.fill();
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
  ctx.fillRect(x - 0.75, 5, 1.5, BASELINE - 5);
  ctx.beginPath();
  ctx.arc(x, 7.75, 3.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The house, as the graph's own home badge (`drawHomeBadge`), lifted by a shadow over the curve. */
function drawHome(ctx: CanvasRenderingContext2D, { home, homePending, homeOlderThanRange, palette }: TimelineDrawing): void {
  if (!home) return;
  drawHomeBadge(ctx, home.x, home.y, HOUSE_RADIUS, palette, { dashed: homePending, shadow: true });
  if (!homeOlderThanRange) return;
  ctx.save();
  ctx.font = `700 11px ${palette.fontUi}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.fillStyle = palette.accentText;
  ctx.fillText('‹', home.x - HOUSE_RADIUS - 2, home.y);
  ctx.restore();
}

/** The frame's box: from `FRAME_TOP`, `FRAME_HEIGHT` tall, its corners rounded. */
function frameBox(ctx: CanvasRenderingContext2D, frame: TimelineFrame, inset: number): void {
  roundedRect(ctx, frame.left + inset, FRAME_TOP + inset, Math.max(0, frame.right - frame.left - inset * 2), FRAME_HEIGHT - inset * 2, Math.max(0, FRAME_RADIUS - inset));
}

/** Under what the frame covers: its halo, then its wash. A frame thinner than a line has neither. */
function drawFrameBack(ctx: CanvasRenderingContext2D, { frame, frameActive, palette }: TimelineDrawing): void {
  if (frameShape(frame) === 'line') return;
  ctx.save();
  ctx.strokeStyle = palette.accentSoft;
  ctx.lineWidth = HALO_WIDTH;
  ctx.globalAlpha = frameActive ? 1 : RESTING_HALO_ALPHA;
  frameBox(ctx, frame, -HALO_WIDTH / 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.accentWash;
  frameBox(ctx, frame, 0);
  ctx.fill();
  ctx.restore();
}

/** The frame's outline and, while hovered or dragged, its edges' grips; thinner than a line, a line with a handle on top. */
function drawFrame(ctx: CanvasRenderingContext2D, { frame, frameActive, palette }: TimelineDrawing): void {
  const shape = frameShape(frame);
  ctx.save();
  ctx.fillStyle = palette.accent;
  if (shape === 'line') {
    const x = (frame.left + frame.right) / 2;
    roundedRect(ctx, x - 1, FRAME_TOP, 2, FRAME_HEIGHT + 2, 1);
    ctx.fill();
    // A handle to take hold of it, ringed in the strip's background so it stands off the curve.
    ctx.fillStyle = palette.panel;
    roundedRect(ctx, x - 7, FRAME_TOP - 4, 14, 14, 5);
    ctx.fill();
    ctx.fillStyle = palette.accent;
    roundedRect(ctx, x - 5, FRAME_TOP - 2, 10, 10, 3);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 1.5;
  frameBox(ctx, frame, 0.75);
  ctx.stroke();
  if (shape === 'boxWithEdges' && frameActive) {
    for (const x of [frame.left - 3, frame.right - 1]) {
      roundedRect(ctx, x, FRAME_TOP + 12, 4, 14, 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Where a click would take the frame: the same rounded box, dashed; a dashed line where the frame is one. */
function drawGhostFrame(ctx: CanvasRenderingContext2D, ghost: TimelineFrame, palette: GraphPalette): void {
  ctx.save();
  ctx.strokeStyle = palette.textTertiary;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  if (frameShape(ghost) === 'line') {
    const x = Math.round((ghost.left + ghost.right) / 2) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, FRAME_TOP + 1);
    ctx.lineTo(x, FRAME_TOP + FRAME_HEIGHT - 1);
    ctx.stroke();
  } else {
    roundedRect(ctx, ghost.left + 0.5, FRAME_TOP + 1.5, Math.max(0, ghost.right - ghost.left - 1), FRAME_HEIGHT - 3, FRAME_RADIUS);
    ctx.stroke();
  }
  ctx.restore();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}
