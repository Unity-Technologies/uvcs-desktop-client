import type { CodeReview } from '@shared/domain/codeReview';
import { SHORT_STATUS } from '../../codeReviews/reviewsByBranch';
import type { Lane } from '../model/layoutGraph';
import { DIMMED_ALPHA, type DrawContext } from './drawContext';
import { drawRectHit } from './drawSearchHit';
import { fitText, summaryOf } from './fitText';
import { BAND_HEIGHT, HEADER_HEIGHT, HEADER_MAX_WIDTH, headerTop, ROW_HEIGHT } from './geometry';
import { branchColor } from './graphPalette';
import { laneShape } from './laneShape';

const PADDING = 8;
const DOT_SIZE = 7;
const GAP = 6;
const MIN_WIDTH = 64;
/** Keeps a card clear of the next branch band on the same row. */
const CLEARANCE = 12;
const CURRENT_BADGE = 'current';
const CARD_RADIUS = 6;

/**
 * A small card above each band with the branch name and comment. While the start of a band is
 * scrolled away, its card stays pinned to the left edge so the branch stays identifiable.
 */
export function drawBranchHeaders(draw: DrawContext): void {
  const { scene, visible } = draw;
  for (const lane of scene.layout.lanes) {
    const shape = laneShape(lane);
    const top = headerTop(shape.y);
    if (shape.right < visible.left || shape.left > visible.right || top > visible.bottom || top + HEADER_HEIGHT < visible.top) continue;

    const room = Math.min(HEADER_MAX_WIDTH, roomBeforeNextLane(draw, lane, shape.left));
    const width = Math.max(MIN_WIDTH, Math.min(room, measureContent(draw, lane) + PADDING * 2));
    const pinnedLeft = visible.left + 8 / scene.viewport.zoom;
    const left = Math.max(shape.left, Math.min(pinnedLeft, shape.right - width));
    drawCard(draw, lane, left, top, width);
  }
}

/** Rows closer than this on screen are too crowded for names. */
const MIN_ROW_SPACING_FOR_NAMES = 24;

/**
 * Zoomed out, cards would be unreadably small: branch names are drawn at a fixed screen size
 * just above each band instead, as long as the rows are not too crowded. Drawn in screen coordinates.
 */
export function drawCompactBranchNames(draw: DrawContext): void {
  const { ctx, scene, visible } = draw;
  const { viewport, palette } = scene;
  if (ROW_HEIGHT * viewport.zoom < MIN_ROW_SPACING_FOR_NAMES) return;

  ctx.save();
  ctx.font = `600 10.5px ${palette.fontUi}`;
  ctx.textBaseline = 'bottom';
  for (const lane of scene.layout.lanes) {
    const shape = laneShape(lane);
    if (shape.right < visible.left || shape.left > visible.right || shape.y < visible.top || shape.y > visible.bottom) continue;

    const left = Math.max(shape.left * viewport.zoom + viewport.panX, 6);
    const right = shape.right * viewport.zoom + viewport.panX;
    const room = Math.max(60, roomBeforeNextLane(draw, lane, shape.left) * viewport.zoom);
    const bottom = (shape.y - BAND_HEIGHT / 2) * viewport.zoom + viewport.panY - 3;
    const name = fitText(ctx, lane.branch.name, Math.min(room, Math.max(60, right - left + 80)));
    ctx.globalAlpha = scene.search && !scene.search.branches.has(lane.branch.name) ? DIMMED_ALPHA : 1;
    ctx.strokeStyle = palette.background;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeText(name, left, bottom);
    ctx.fillStyle = branchColor(palette, lane.branch.name);
    ctx.fillText(name, left, bottom);
  }
  ctx.restore();
}

function roomBeforeNextLane({ scene }: DrawContext, lane: Lane, left: number): number {
  const next = (scene.layout.lanesByRow.get(lane.row) ?? [])
    .map((other) => laneShape(other).left)
    .filter((otherLeft) => otherLeft > left)
    .sort((a, b) => a - b)[0];
  return next === undefined ? Number.POSITIVE_INFINITY : next - left - CLEARANCE;
}

function nameFont({ scene }: DrawContext): string {
  return `600 11.5px ${scene.palette.fontUi}`;
}

function commentFont({ scene }: DrawContext): string {
  return `400 11px ${scene.palette.fontUi}`;
}

function measureContent(draw: DrawContext, lane: Lane): number {
  const { ctx } = draw;
  ctx.save();
  ctx.font = nameFont(draw);
  let width = DOT_SIZE + GAP + ctx.measureText(lane.branch.name).width;
  if (draw.scene.currentBranch === lane.branch.name) width += GAP + currentBadgeWidth(draw);
  const review = draw.scene.reviews.get(lane.branch.name);
  if (review) width += GAP + reviewChipWidth(draw, review);
  const comment = summaryOf(lane.branch.comment);
  if (comment) {
    ctx.font = commentFont(draw);
    width += GAP * 1.5 + ctx.measureText(comment).width;
  }
  ctx.restore();
  return width;
}

function drawCard(draw: DrawContext, lane: Lane, left: number, top: number, width: number): void {
  const { ctx, scene } = draw;
  const { palette } = scene;
  const selected = scene.selectedBranch === lane.branch.name;
  const current = scene.currentBranch === lane.branch.name;
  const color = branchColor(palette, lane.branch.name);
  const middle = top + HEADER_HEIGHT / 2;
  const { search } = scene;

  ctx.save();
  if (search?.branches.has(lane.branch.name)) {
    const current = search.active?.kind === 'branch' && search.active.name === lane.branch.name;
    drawRectHit(ctx, { x: left, y: top, width, height: HEADER_HEIGHT }, CARD_RADIUS, palette.searchHit, current, scene.searchPing);
  } else if (search) {
    ctx.globalAlpha = DIMMED_ALPHA;
  }
  ctx.beginPath();
  ctx.roundRect(left, top, width, HEADER_HEIGHT, CARD_RADIUS);
  ctx.fillStyle = palette.surfaceRaised;
  ctx.fill();
  ctx.strokeStyle = selected ? palette.accent : palette.border;
  ctx.lineWidth = selected ? 1.5 : 1;
  ctx.stroke();
  ctx.clip();

  let x = left + PADDING;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, middle - DOT_SIZE / 2, DOT_SIZE, DOT_SIZE, 2);
  ctx.fill();
  x += DOT_SIZE + GAP;

  const right = left + width - PADDING;
  ctx.textBaseline = 'middle';
  const badgeWidth = current ? currentBadgeWidth(draw) : 0;
  const review = scene.reviews.get(lane.branch.name);
  const chipWidth = review ? reviewChipWidth(draw, review) : 0;
  const reserved = (badgeWidth ? badgeWidth + GAP : 0) + (chipWidth ? chipWidth + GAP : 0);

  ctx.font = nameFont(draw);
  ctx.fillStyle = palette.textPrimary;
  const name = fitText(ctx, lane.branch.name, right - x - reserved);
  ctx.fillText(name, x, middle + 0.5);
  x += ctx.measureText(name).width + GAP;

  if (current) {
    drawCurrentBadge(draw, x, middle, badgeWidth);
    x += badgeWidth + GAP;
  }
  if (review && x + chipWidth <= right + PADDING / 2) {
    drawReviewChip(draw, review, x, middle, chipWidth, scene.hoveredReview === review.id);
    x += chipWidth + GAP;
  }

  const comment = summaryOf(lane.branch.comment);
  if (comment && right - x > 24) {
    ctx.font = commentFont(draw);
    ctx.fillStyle = palette.textTertiary;
    ctx.fillText(fitText(ctx, comment, right - x - GAP / 2), x + GAP / 2, middle + 0.5);
  }
  ctx.restore();
}

const CHIP_HEIGHT = 15;
const CHIP_DOT = 5;

function reviewChipWidth(draw: DrawContext, review: CodeReview): number {
  const { ctx } = draw;
  ctx.save();
  ctx.font = badgeFont(draw);
  const width = ctx.measureText(SHORT_STATUS[review.status]).width + CHIP_DOT + 13;
  ctx.restore();
  return width;
}

/** The branch's code review status, colored like the badges elsewhere; recorded so a click on it opens the review. */
function drawReviewChip(draw: DrawContext, review: CodeReview, left: number, middle: number, width: number, hovered: boolean): void {
  const { ctx, scene } = draw;
  const color = scene.palette.reviewStatus[review.status];
  const top = middle - CHIP_HEIGHT / 2;
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = hovered ? 0.28 : 0.16;
  ctx.beginPath();
  ctx.roundRect(left, top, width, CHIP_HEIGHT, CHIP_HEIGHT / 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(left + 5 + CHIP_DOT / 2, middle, CHIP_DOT / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = badgeFont(draw);
  ctx.fillText(SHORT_STATUS[review.status], left + 8 + CHIP_DOT, middle + 0.5);
  ctx.restore();
  draw.reviewChips.push({ review, x: left, y: top, width, height: CHIP_HEIGHT });
}

function badgeFont({ scene }: DrawContext): string {
  return `600 9.5px ${scene.palette.fontUi}`;
}

function currentBadgeWidth(draw: DrawContext): number {
  const { ctx } = draw;
  ctx.save();
  ctx.font = badgeFont(draw);
  const width = ctx.measureText(CURRENT_BADGE).width + 10;
  ctx.restore();
  return width;
}

function drawCurrentBadge(draw: DrawContext, left: number, middle: number, width: number): void {
  const { ctx, scene } = draw;
  const height = 14;
  ctx.save();
  ctx.fillStyle = scene.palette.current;
  ctx.globalAlpha = 0.16;
  ctx.beginPath();
  ctx.roundRect(left, middle - height / 2, width, height, height / 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.font = badgeFont(draw);
  ctx.fillText(CURRENT_BADGE, left + 5, middle + 0.5);
  ctx.restore();
}
