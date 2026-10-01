import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { Lane } from '../model/layoutGraph';
import { GHOST_ALPHA, type DrawContext } from './drawContext';
import { drawRectCorona, drawRectGlow } from './drawSearchHit';
import { headerCardLeft } from './headerCardLeft';
import { drawReviewChip, reviewChipWidth } from './drawReviewChip';
import { fitBranchName, fitText, summaryOf, textWidth } from './fitText';
import { HEADER_COMMENT_MIDDLE, HEADER_HEIGHT, HEADER_INSET, HEADER_MAX_WIDTH, HEADER_NAME_MIDDLE, headerTop } from './geometry';
import { branchColor, HEADER_HOVER_TINT, HEADER_TINT, headerInks, type GraphPalette } from './graphPalette';
import { strokeHouse } from './houseGlyph';
import { laneHeaderHeight, laneShape, roomBeforeNextLane } from './laneShape';
import { lanesAcross } from './spansInView';
import { drawSearchMarks, redrawMarkedLetters } from './searchMarks';

const PADDING = 8;
const GAP = 6;
const MIN_WIDTH = 56;
const CARD_RADIUS = 6;
/** The current branch's card leads with a solid accent cap holding the home glyph. */
const HOME_CAP_WIDTH = HEADER_HEIGHT;
/** How far in from the left edge a pinned card rides. */
const PINNED_INSET = 8;
/** Heights of the search marks behind the name and the comment. */
const NAME_MARK_HEIGHT = 15;
const COMMENT_MARK_HEIGHT = 13;
/** For the pointer, the comment line starts halfway between the two lines and runs to the pill's bottom edge. */
const COMMENT_LINE_TOP = (HEADER_NAME_MIDDLE + HEADER_COMMENT_MIDDLE) / 2;

/**
 * A pill on the top edge of each band, overlapping it a little so the two read as one shape, tinted in the branch's
 * color with a border stronger than the band's, in two lines like the official client's: the branch name with its
 * code review, then the comment, smaller and in a quieter ink of the branch's hue (a branch without a comment gets a
 * one-line pill). It grows to the longer line, up to a few columns and never into the next branch on its row. While
 * the start of a band is scrolled away, its pill stays pinned to the left edge (floating, with a shadow), whole for as
 * long as any of the band shows, so the branch stays identifiable. Records where each pill landed for the pointer, and
 * where its comment line lies when it doesn't show the whole comment.
 */
export function drawBranchHeaders(draw: DrawContext): void {
  const { scene, visible } = draw;
  for (const lane of lanesAcross(scene.layout, visible.left, visible.right)) {
    const shape = laneShape(lane);
    const height = laneHeaderHeight(lane);
    const top = headerTop(shape.y, height);
    if (shape.right < visible.left || shape.left > visible.right || top > visible.bottom || top + height < visible.top) continue;

    const restLeft = shape.left + HEADER_INSET;
    const roomBeforeNext = roomBeforeNextLane(scene.layout, lane, restLeft);
    const width = Math.max(MIN_WIDTH, Math.min(HEADER_MAX_WIDTH, roomBeforeNext, contentWidth(draw, lane) + PADDING * 2));
    const pinnedLeft = visible.left + PINNED_INSET / scene.viewport.zoom;
    const left = headerCardLeft(restLeft, width, pinnedLeft, restLeft + roomBeforeNext);
    drawCard(draw, lane, left, top, width, height, left > restLeft + 0.5);
    draw.drawn.branchHeaders.add(lane, left, top, width, height);
  }
}

/** What a card's texts measure in world px, kept per lane: the fonts are the theme's and don't change with the zoom. */
interface CardMetrics {
  palette: GraphPalette;
  review: CodeReviewSummary | undefined;
  name: number;
  chip: number;
  comment: number;
}

const metricsByLane = new WeakMap<Lane, CardMetrics>();

function cardMetrics(draw: DrawContext, lane: Lane): CardMetrics {
  const { ctx, scene } = draw;
  const { palette } = scene;
  const review = scene.reviews.get(lane.branch.id);
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

/** Draws a branch's pill, recording its comment line when that doesn't show the whole comment. */
function drawCard(draw: DrawContext, lane: Lane, left: number, top: number, width: number, height: number, pinned: boolean): void {
  const { ctx, pen, scene } = draw;
  const { palette, search } = scene;
  const name = lane.branch.name;
  const selected = scene.selectedBranch === name;
  const current = scene.currentBranch === name;
  const hovered = scene.hoveredBranch === name;
  const isHit = search?.branches.has(name) ?? false;
  const ghost = search !== null && !search.litBranches.has(name);
  const color = current ? palette.accent : branchColor(palette, name);
  const inks = headerInks(palette, name, current);

  ctx.save();
  if (isHit) drawRectGlow(draw, left, top, width, height, CARD_RADIUS, search?.active?.kind === 'branch' && search.active.name === name);

  // The opaque base never fades: a see-through pill lets the lines behind bleed through its text.
  ctx.beginPath();
  pen.roundRect(left, top, width, height, CARD_RADIUS);
  if (pinned && !isHit) {
    ctx.shadowColor = palette.isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(31, 35, 40, 0.22)';
    ctx.shadowBlur = 6 * draw.pixelRatio * scene.viewport.zoom;
    ctx.shadowOffsetY = 1 * draw.pixelRatio * scene.viewport.zoom;
  }
  ctx.fillStyle = palette.surfaceRaised;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // The band's tint, stronger, and a border stronger than the band's. Fading a branch without hits fades its ink:
  // tint, border and text.
  const ink = ghost ? GHOST_ALPHA : 1;
  ctx.fillStyle = color;
  ctx.globalAlpha = ink * (HEADER_TINT[palette.isDark ? 'dark' : 'light'] + (hovered ? HEADER_HOVER_TINT : 0));
  ctx.fill();
  ctx.strokeStyle = selected ? palette.accent : color;
  ctx.globalAlpha = ink * (selected || current ? 1 : hovered ? 0.75 : 0.55);
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
  const review = scene.reviews.get(lane.branch.id);
  const chipWidth = cardMetrics(draw, lane).chip;
  ctx.textBaseline = 'middle';
  ctx.font = palette.fonts.branchName;
  const fitted = fitBranchName(ctx, name, right - x - (chipWidth ? chipWidth + GAP : 0));
  if (fitted !== name) draw.drawn.cutBranchNames.add(lane, x, top, textWidth(ctx, fitted), COMMENT_LINE_TOP);
  drawSearchMarks(draw, fitted, x, nameMiddle, NAME_MARK_HEIGHT);
  ctx.fillStyle = inks.name;
  pen.fillText(fitted, x, nameMiddle + 0.5);
  redrawMarkedLetters(draw, fitted, x, nameMiddle + 0.5);
  x += textWidth(ctx, fitted) + GAP;
  if (review && x + chipWidth <= right + PADDING / 2) drawReviewChip(draw, review, x, nameMiddle, chipWidth, scene.hoveredReview === review.id);

  // Second line: the comment's summary, smaller and quieter, in the same hue, cut at the end.
  const comment = summaryOf(lane.branch.comment);
  if (comment) {
    const commentMiddle = top + HEADER_COMMENT_MIDDLE;
    ctx.font = palette.fonts.branchComment;
    const text = fitText(ctx, comment, right - textLeft);
    // Only the first line shows: more lines are hidden text too.
    if (text !== comment || lane.branch.comment.trim() !== comment) {
      draw.drawn.cutBranchComments.add(lane, textLeft, top + COMMENT_LINE_TOP, textWidth(ctx, text), height - COMMENT_LINE_TOP);
    }
    drawSearchMarks(draw, text, textLeft, commentMiddle, COMMENT_MARK_HEIGHT);
    ctx.fillStyle = inks.comment;
    pen.fillText(text, textLeft, commentMiddle + 0.5);
    redrawMarkedLetters(draw, text, textLeft, commentMiddle + 0.5);
  }
  ctx.restore();

  if (search?.active?.kind === 'branch' && search.active.name === name) drawRectCorona(draw, left, top, width, height, CARD_RADIUS);
}

/** The first part of the current branch's pill in solid accent, the home glyph knocked out of it. */
function drawHomeCap({ ctx, pen, scene }: DrawContext, left: number, top: number, height: number): void {
  const { palette } = scene;
  ctx.save();
  ctx.beginPath();
  pen.rect(left, top, HOME_CAP_WIDTH, height);
  ctx.clip();
  ctx.beginPath();
  pen.roundRect(left, top, HOME_CAP_WIDTH + CARD_RADIUS * 2, height, CARD_RADIUS);
  ctx.fillStyle = palette.accent;
  ctx.fill();
  ctx.restore();
  strokeHouse(ctx, left + HOME_CAP_WIDTH / 2, top + height / 2, 0.72, palette.accentContrast, 1.3, pen);
}
