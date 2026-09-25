import type { CodeReview } from '@shared/domain/codeReview';
import type { Lane } from '../model/layoutGraph';
import { GHOST_ALPHA, type DrawContext } from './drawContext';
import { drawRectCorona, drawRectGlow } from './drawSearchHit';
import { drawReviewChip, reviewChipWidth } from './drawReviewChip';
import { fitBranchName, fitText, summaryOf, textWidth } from './fitText';
import { BAND_HEIGHT, HEADER_COMMENT_MIDDLE, HEADER_HEIGHT, HEADER_MAX_WIDTH, HEADER_NAME_MIDDLE, headerTop, ROW_HEIGHT } from './geometry';
import { branchColor, branchInk, type GraphPalette } from './graphPalette';
import { strokeHouse } from './houseGlyph';
import { laneHeaderHeight, laneShape } from './laneShape';
import { drawSearchMarks, redrawMarkedLetters } from './searchMarks';

const PADDING = 8;
const GAP = 6;
const MIN_WIDTH = 56;
/** Keeps a card clear of the next branch band on the same row. */
const CLEARANCE = 12;
const CARD_RADIUS = 6;
/** The current branch's card leads with a solid accent cap holding the home glyph. */
const HOME_CAP_WIDTH = HEADER_HEIGHT;
/** How far in from the left edge a pinned card rides. */
const PINNED_INSET = 8;
/** Heights of the search marks behind the name and the comment. */
const NAME_MARK_HEIGHT = 15;
const COMMENT_MARK_HEIGHT = 13;

/**
 * A pill above each band, tinted in the branch's color, in two lines like the official client's: the branch name
 * with its code review, then the comment, smaller and muted (a branch without a comment gets a one-line pill). It
 * grows to the longer line, up to a few columns and never into the next branch on its row. While the start of a band
 * is scrolled away, its pill stays pinned to the left edge (floating, with a shadow) so the branch stays
 * identifiable. Records where each pill landed for the pointer.
 */
export function drawBranchHeaders(draw: DrawContext): void {
  const { scene, visible } = draw;
  for (const lane of scene.layout.lanes) {
    const shape = laneShape(lane);
    const height = laneHeaderHeight(lane);
    const top = headerTop(shape.y, height);
    if (shape.right < visible.left || shape.left > visible.right || top > visible.bottom || top + height < visible.top) continue;

    const room = Math.min(HEADER_MAX_WIDTH, roomBeforeNextLane(draw, lane, shape.left));
    const width = Math.max(MIN_WIDTH, Math.min(room, contentWidth(draw, lane) + PADDING * 2));
    const pinnedLeft = visible.left + PINNED_INSET / scene.viewport.zoom;
    const left = Math.max(shape.left, Math.min(pinnedLeft, shape.right - width));
    drawCard(draw, lane, left, top, width, height, left > shape.left + 0.5);
    draw.drawn.branchHeaders.add(lane, left, top, width, height);
  }
}

/** Rows closer than this on screen are too crowded for names. */
const MIN_ROW_SPACING_FOR_NAMES = 24;
const COMPACT_NAME_HEIGHT = 13;

/**
 * Zoomed out, cards would be unreadably small: branch names are drawn at a fixed screen size
 * just above each band instead, as long as the rows are not too crowded. Drawn in screen coordinates.
 */
export function drawCompactBranchNames(draw: DrawContext): void {
  const { ctx, scene, visible } = draw;
  const { viewport, palette, search } = scene;
  if (ROW_HEIGHT * viewport.zoom < MIN_ROW_SPACING_FOR_NAMES) return;

  ctx.save();
  ctx.font = palette.fonts.compactBranchName;
  ctx.textBaseline = 'bottom';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = palette.background;
  for (const lane of scene.layout.lanes) {
    const shape = laneShape(lane);
    if (shape.right < visible.left || shape.left > visible.right || shape.y < visible.top || shape.y > visible.bottom) continue;

    const left = Math.max(shape.left * viewport.zoom + viewport.panX, 6);
    const right = shape.right * viewport.zoom + viewport.panX;
    const room = Math.max(60, roomBeforeNextLane(draw, lane, shape.left) * viewport.zoom);
    const bottom = (shape.y - BAND_HEIGHT / 2) * viewport.zoom + viewport.panY - 3;
    const name = fitBranchName(ctx, lane.branch.name, Math.min(room, Math.max(60, right - left + 80)));
    ctx.globalAlpha = search && !search.litBranches.has(lane.branch.name) ? GHOST_ALPHA : 1;
    drawSearchMarks(draw, name, left, bottom - COMPACT_NAME_HEIGHT / 2 + 1, COMPACT_NAME_HEIGHT + 1);
    ctx.strokeText(name, left, bottom);
    ctx.fillStyle = scene.currentBranch === lane.branch.name ? palette.accentText : branchInk(palette, lane.branch.name);
    ctx.fillText(name, left, bottom);
    redrawMarkedLetters(draw, name, left, bottom);
    draw.drawn.branchHeaders.add(
      lane,
      (left - viewport.panX) / viewport.zoom,
      (bottom - COMPACT_NAME_HEIGHT - viewport.panY) / viewport.zoom,
      textWidth(ctx, name) / viewport.zoom,
      COMPACT_NAME_HEIGHT / viewport.zoom,
    );
  }
  ctx.restore();
}

function roomBeforeNextLane({ scene }: DrawContext, lane: Lane, left: number): number {
  let next = Number.POSITIVE_INFINITY;
  for (const other of scene.layout.lanesByRow.get(lane.row) ?? []) {
    const otherLeft = laneShape(other).left;
    if (otherLeft > left && otherLeft < next) next = otherLeft;
  }
  return next - left - CLEARANCE;
}

/** What a card's texts measure in world px, kept per lane: the fonts are the theme's and don't change with the zoom. */
interface CardMetrics {
  palette: GraphPalette;
  review: CodeReview | undefined;
  name: number;
  chip: number;
  comment: number;
}

const metricsByLane = new WeakMap<Lane, CardMetrics>();

function cardMetrics(draw: DrawContext, lane: Lane): CardMetrics {
  const { ctx, scene } = draw;
  const { palette } = scene;
  const review = scene.reviews.get(lane.branch.name);
  const known = metricsByLane.get(lane);
  if (known?.palette === palette && known.review === review) return known;

  const comment = summaryOf(lane.branch.comment);
  ctx.save();
  ctx.font = palette.fonts.branchName;
  const name = textWidth(ctx, lane.branch.name);
  ctx.font = palette.fonts.branchComment;
  const metrics = { palette, review, name, chip: review ? reviewChipWidth(draw, review) : 0, comment: comment ? textWidth(ctx, comment) : 0 };
  ctx.restore();
  metricsByLane.set(lane, metrics);
  return metrics;
}

/** The width of the longer line: the name and its code review, or the comment below them. */
function contentWidth(draw: DrawContext, lane: Lane): number {
  const { name, chip, comment } = cardMetrics(draw, lane);
  const lead = draw.scene.currentBranch === lane.branch.name ? HOME_CAP_WIDTH : 0;
  return lead + Math.max(name + (chip ? GAP + chip : 0), comment);
}

/** Draws a branch's pill. */
function drawCard(draw: DrawContext, lane: Lane, left: number, top: number, width: number, height: number, pinned: boolean): void {
  const { ctx, scene } = draw;
  const { palette, search } = scene;
  const name = lane.branch.name;
  const selected = scene.selectedBranch === name;
  const current = scene.currentBranch === name;
  const hovered = scene.hoveredBranch === name;
  const isHit = search?.branches.has(name) ?? false;
  const ghost = search !== null && !search.litBranches.has(name);
  const color = current ? palette.accent : branchColor(palette, name);

  ctx.save();
  if (isHit) drawRectGlow(draw, left, top, width, height, CARD_RADIUS, search?.active?.kind === 'branch' && search.active.name === name);

  // The opaque base never fades: a see-through pill lets the lines behind bleed through its text.
  ctx.beginPath();
  ctx.roundRect(left, top, width, height, CARD_RADIUS);
  if (pinned && !isHit) {
    ctx.shadowColor = palette.isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(31, 35, 40, 0.22)';
    ctx.shadowBlur = 6 * draw.pixelRatio * scene.viewport.zoom;
    ctx.shadowOffsetY = 1 * draw.pixelRatio * scene.viewport.zoom;
  }
  ctx.fillStyle = palette.surfaceRaised;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Fading a branch without hits fades its ink: tint, border and text.
  const ink = ghost ? GHOST_ALPHA : 1;
  ctx.fillStyle = color;
  ctx.globalAlpha = ink * ((palette.isDark ? 0.16 : 0.1) + (hovered ? 0.06 : 0));
  ctx.fill();
  ctx.strokeStyle = selected ? palette.accent : color;
  ctx.globalAlpha = ink * (selected || current ? 1 : hovered ? 0.75 : 0.5);
  ctx.lineWidth = selected ? 1.5 : 1;
  ctx.stroke();
  ctx.clip();
  ctx.globalAlpha = ink;

  let x = left + PADDING;
  if (current) {
    drawHomeCap(draw, left, top, height);
    x = left + HOME_CAP_WIDTH + PADDING - 2;
  }
  const textLeft = x;
  const right = left + width - PADDING;

  // First line: the name, cut from the middle so the leaf stays, then its code review.
  const nameMiddle = top + HEADER_NAME_MIDDLE;
  const review = scene.reviews.get(name);
  const chipWidth = cardMetrics(draw, lane).chip;
  ctx.textBaseline = 'middle';
  ctx.font = palette.fonts.branchName;
  const fitted = fitBranchName(ctx, name, right - x - (chipWidth ? chipWidth + GAP : 0));
  drawSearchMarks(draw, fitted, x, nameMiddle, NAME_MARK_HEIGHT);
  ctx.fillStyle = current ? palette.accentText : branchInk(palette, name);
  ctx.fillText(fitted, x, nameMiddle + 0.5);
  redrawMarkedLetters(draw, fitted, x, nameMiddle + 0.5);
  x += textWidth(ctx, fitted) + GAP;
  if (review && x + chipWidth <= right + PADDING / 2) drawReviewChip(draw, review, x, nameMiddle, chipWidth, scene.hoveredReview === review.id);

  // Second line: the comment's summary, smaller and muted, cut at the end.
  const comment = summaryOf(lane.branch.comment);
  if (comment) {
    const commentMiddle = top + HEADER_COMMENT_MIDDLE;
    ctx.font = palette.fonts.branchComment;
    const text = fitText(ctx, comment, right - textLeft);
    drawSearchMarks(draw, text, textLeft, commentMiddle, COMMENT_MARK_HEIGHT);
    ctx.fillStyle = palette.textTertiary;
    ctx.fillText(text, textLeft, commentMiddle + 0.5);
    redrawMarkedLetters(draw, text, textLeft, commentMiddle + 0.5);
  }
  ctx.restore();

  if (search?.active?.kind === 'branch' && search.active.name === name) drawRectCorona(draw, left, top, width, height, CARD_RADIUS);
}

/** The first part of the current branch's pill in solid accent, the home glyph knocked out of it. */
function drawHomeCap({ ctx, scene }: DrawContext, left: number, top: number, height: number): void {
  const { palette } = scene;
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, HOME_CAP_WIDTH, height);
  ctx.clip();
  ctx.beginPath();
  ctx.roundRect(left, top, HOME_CAP_WIDTH + CARD_RADIUS * 2, height, CARD_RADIUS);
  ctx.fillStyle = palette.accent;
  ctx.fill();
  ctx.restore();
  strokeHouse(ctx, left + HOME_CAP_WIDTH / 2, top + height / 2, 0.72, palette.accentContrast, 1.3);
}
