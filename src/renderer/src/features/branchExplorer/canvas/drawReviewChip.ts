import type { CodeReviewSummary } from '@shared/domain/codeReview';
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
  const width = PAD_X * 2 + GLYPH + GLYPH_GAP + textWidth(ctx, SHORT_STATUS[review.status]);
  ctx.restore();
  return width;
}

/**
 * The branch's code review, as the header's last word before the comment: a hairline divider, then the status glyph
 * and name in the status color (a check once reviewed, a dot otherwise). No patch of its own, so it reads as part of
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

  const glyphX = left + PAD_X;
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
