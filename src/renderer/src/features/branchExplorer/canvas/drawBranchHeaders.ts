import type { Lane } from '../model/layoutGraph';
import { GHOST_ALPHA, type DrawContext } from './drawContext';
import { drawRectCorona, drawRectGlow } from './drawSearchHit';
import { drawReviewChip, reviewChipWidth } from './drawReviewChip';
import { fitBranchName, fitText, summaryOf, textWidth } from './fitText';
import { BAND_HEIGHT, HEADER_HEIGHT, HEADER_MAX_WIDTH, headerTop, ROW_HEIGHT } from './geometry';
import { branchColor, branchInk } from './graphPalette';
import { strokeHouse } from './houseGlyph';
import { laneShape } from './laneShape';

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

/**
 * A pill above each band with the branch name, its code review and its comment, tinted in the branch's color.
 * While the start of a band is scrolled away, its pill stays pinned to the left edge (floating, with a shadow)
 * so the branch stays identifiable. Records where each pill landed for the pointer.
 */
export function drawBranchHeaders(draw: DrawContext): void {
  const { scene, visible } = draw;
  for (const lane of scene.layout.lanes) {
    const shape = laneShape(lane);
    const top = headerTop(shape.y);
    if (shape.right < visible.left || shape.left > visible.right || top > visible.bottom || top + HEADER_HEIGHT < visible.top) continue;

    const room = Math.min(HEADER_MAX_WIDTH, roomBeforeNextLane(draw, lane, shape.left));
    const width = Math.max(MIN_WIDTH, Math.min(room, measureContent(draw, lane) + PADDING * 2));
    const pinnedLeft = visible.left + PINNED_INSET / scene.viewport.zoom;
    const left = Math.max(shape.left, Math.min(pinnedLeft, shape.right - width));
    drawCard(draw, lane, left, top, width, left > shape.left + 0.5);
    draw.drawn.branchHeaders.add(lane, left, top, width, HEADER_HEIGHT);
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
    ctx.strokeText(name, left, bottom);
    ctx.fillStyle = scene.currentBranch === lane.branch.name ? palette.accentText : branchInk(palette, lane.branch.name);
    ctx.fillText(name, left, bottom);
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

function measureContent(draw: DrawContext, lane: Lane): number {
  const { ctx, scene } = draw;
  const { fonts } = scene.palette;
  ctx.font = fonts.branchName;
  let width = textWidth(ctx, lane.branch.name);
  if (scene.currentBranch === lane.branch.name) width += HOME_CAP_WIDTH;
  const review = scene.reviews.get(lane.branch.name);
  if (review) width += GAP + reviewChipWidth(draw, review);
  const comment = summaryOf(lane.branch.comment);
  if (comment) {
    ctx.font = fonts.branchComment;
    width += GAP * 1.5 + textWidth(ctx, comment);
  }
  return width;
}

function drawCard(draw: DrawContext, lane: Lane, left: number, top: number, width: number, pinned: boolean): void {
  const { ctx, scene } = draw;
  const { palette, search } = scene;
  const name = lane.branch.name;
  const selected = scene.selectedBranch === name;
  const current = scene.currentBranch === name;
  const hovered = scene.hoveredBranch === name;
  const isHit = search?.branches.has(name) ?? false;
  const ghost = search !== null && !search.litBranches.has(name);
  const color = current ? palette.accent : branchColor(palette, name);
  const middle = top + HEADER_HEIGHT / 2;

  ctx.save();
  if (isHit) drawRectGlow(draw, left, top, width, HEADER_HEIGHT, CARD_RADIUS, search?.active?.kind === 'branch' && search.active.name === name);

  // The opaque base never fades: a see-through pill lets the lines behind bleed through its text.
  ctx.beginPath();
  ctx.roundRect(left, top, width, HEADER_HEIGHT, CARD_RADIUS);
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
    drawHomeCap(draw, left, top);
    x = left + HOME_CAP_WIDTH + PADDING - 2;
  }

  const right = left + width - PADDING;
  const review = scene.reviews.get(name);
  const chipWidth = review ? reviewChipWidth(draw, review) : 0;
  ctx.textBaseline = 'middle';
  ctx.font = palette.fonts.branchName;
  ctx.fillStyle = current ? palette.accentText : branchInk(palette, name);
  const fitted = fitBranchName(ctx, name, right - x - (chipWidth ? chipWidth + GAP : 0));
  ctx.fillText(fitted, x, middle + 0.5);
  x += textWidth(ctx, fitted) + GAP;

  if (review && x + chipWidth <= right + PADDING / 2) {
    drawReviewChip(draw, review, x, middle, chipWidth, scene.hoveredReview === review.id);
    x += chipWidth + GAP;
  }

  const comment = summaryOf(lane.branch.comment);
  if (comment && right - x > 24) {
    ctx.font = palette.fonts.branchComment;
    ctx.fillStyle = palette.textTertiary;
    ctx.fillText(fitText(ctx, comment, right - x - GAP / 2), x + GAP / 2, middle + 0.5);
  }
  ctx.restore();

  if (search?.active?.kind === 'branch' && search.active.name === name) drawRectCorona(draw, left, top, width, HEADER_HEIGHT, CARD_RADIUS);
}

/** The first part of the current branch's pill in solid accent, the home glyph knocked out of it. */
function drawHomeCap({ ctx, scene }: DrawContext, left: number, top: number): void {
  const { palette } = scene;
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, HOME_CAP_WIDTH, HEADER_HEIGHT);
  ctx.clip();
  ctx.beginPath();
  ctx.roundRect(left, top, HOME_CAP_WIDTH + CARD_RADIUS * 2, HEADER_HEIGHT, CARD_RADIUS);
  ctx.fillStyle = palette.accent;
  ctx.fill();
  ctx.restore();
  strokeHouse(ctx, left + HOME_CAP_WIDTH / 2, top + HEADER_HEIGHT / 2, 0.72, palette.accentContrast, 1.3);
}
