import type { CodeReviewSummary, MergeRequestState } from '@shared/domain/codeReview';
import { SHORT_STATUS } from '../../codeReviews/reviewsByBranch';
import type { DrawContext } from './drawContext';
import { textWidth } from './fitText';

const CHIP_HEIGHT = 15;
const PAD_X = 4;
const GLYPH = 8;
const GLYPH_GAP = 3;

export function reviewChipWidth({ ctx, scene }: DrawContext, review: CodeReviewSummary): number {
  ctx.save();
  ctx.font = scene.palette.fonts.badge;
  const state = review.mergeRequest ? GLYPH + GLYPH_GAP : 0;
  const width = PAD_X * 2 + state + GLYPH + GLYPH_GAP + textWidth(ctx, SHORT_STATUS[review.status]);
  ctx.restore();
  return width;
}

/**
 * The branch's code review, as the header's last word before the comment: a hairline divider, then a merge request's
 * state glyph in its color (`drawStateGlyph`), then the status glyph and name in the status color (a check once
 * reviewed, a dot otherwise). No patch of its own, so it reads as part of
 * the tinted pill at any zoom; hovering it lights a soft patch, as it opens the review. Recorded for the pointer.
 */
export function drawReviewChip(draw: DrawContext, review: CodeReviewSummary, left: number, middle: number, width: number, hovered: boolean): void {
  const { ctx, pen, scene } = draw;
  const color = scene.palette.reviewStatus[review.status];
  const top = middle - CHIP_HEIGHT / 2;

  ctx.save();
  ctx.strokeStyle = scene.palette.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  pen.moveTo(left - 3, top + 2.5);
  pen.lineTo(left - 3, top + CHIP_HEIGHT - 2.5);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  if (hovered) {
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * 0.16;
    ctx.beginPath();
    pen.roundRect(left, top, width, CHIP_HEIGHT, 4);
    ctx.fill();
    ctx.globalAlpha = alpha;
  }

  const stateX = left + PAD_X;
  if (review.mergeRequest) {
    drawStateGlyph(draw, review.mergeRequest.state, stateX, middle);
  }
  const glyphX = stateX + (review.mergeRequest ? GLYPH + GLYPH_GAP : 0);
  if (review.status === 'Reviewed') {
    const glyphTop = middle - GLYPH / 2;
    ctx.lineWidth = 1.7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pen.moveTo(glyphX + 0.5, glyphTop + 4.3);
    pen.lineTo(glyphX + 3, glyphTop + 6.8);
    pen.lineTo(glyphX + 7.5, glyphTop + 1.6);
    ctx.stroke();
  } else {
    ctx.beginPath();
    pen.arc(glyphX + GLYPH / 2, middle, 2.75, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.font = scene.palette.fonts.badge;
  ctx.textBaseline = 'middle';
  pen.fillText(SHORT_STATUS[review.status], glyphX + GLYPH + GLYPH_GAP, middle + 0.5);
  ctx.restore();
  draw.drawn.reviewChips.add(review, left, top, width, CHIP_HEIGHT);
}

/**
 * A merge request's state at the canvas's size, a shape of its own per state so color never tells it alone, as the
 * glyphs elsewhere (`MERGE_REQUEST_STATE_ICONS`): a ring while Open, a dashed ring for a draft, a disc once merged, a
 * crossed ring once closed. The chip's tooltip names it.
 */
function drawStateGlyph({ ctx, pen, scene }: DrawContext, state: MergeRequestState, left: number, middle: number): void {
  const color = scene.palette.mergeRequestState[state];
  const centerX = left + GLYPH / 2;
  const radius = GLYPH / 2 - 0.75;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  if (state === 'Draft') ctx.setLineDash([1.6, 1.6]);
  ctx.beginPath();
  pen.arc(centerX, middle, radius, 0, Math.PI * 2);
  if (state === 'Merged') ctx.fill();
  else ctx.stroke();
  if (state === 'Closed') {
    ctx.beginPath();
    pen.moveTo(centerX - radius * 0.7, middle - radius * 0.7);
    pen.lineTo(centerX + radius * 0.7, middle + radius * 0.7);
    ctx.stroke();
  }
  ctx.restore();
}
