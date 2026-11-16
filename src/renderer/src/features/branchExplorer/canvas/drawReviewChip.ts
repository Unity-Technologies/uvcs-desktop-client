import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { reviewChipOf } from '../../codeReviews/reviewChip';
import type { DrawContext } from './drawContext';
import { textWidth } from './fitText';
import { STATE_GLYPHS, STATUS_GLYPHS } from './lucideGlyphs';
import { CHIP_HEIGHT, GLYPH, PILL_GLYPH_X, reviewChipLayout, STATUS_ICON, type ReviewChipLayout } from './reviewChipLayout';

/** The pill's tint over the header, as the lists' badges tint theirs; stronger under the pointer, as it opens the review. */
const TINT = 0.14;
const HOVER_TINT = 0.28;

function layoutOf({ ctx, scene }: DrawContext, review: CodeReviewSummary): ReviewChipLayout {
  ctx.save();
  ctx.font = scene.palette.fonts.badge;
  const layout = reviewChipLayout(reviewChipOf(review, false), (text) => textWidth(ctx, text));
  ctx.restore();
  return layout;
}

export function reviewChipWidth(draw: DrawContext, review: CodeReviewSummary): number {
  return layoutOf(draw, review).width;
}

/**
 * The branch's code review, as the header's last word before the comment, drawn as the lists draw it
 * (`CodeReviewChip`, `reviewChipLayout`): a hairline divider, then a tinted pill with the app's own glyph and name in
 * its color (a merge request's state, else a code review's status: `lucideGlyphs`), then a merge request's review
 * icon once decided. Hovering it tints the pill more, as it opens the review (a merge request's summary shows then).
 * Recorded for the pointer.
 */
export function drawReviewChip(draw: DrawContext, review: CodeReviewSummary, left: number, middle: number, width: number, hovered: boolean): void {
  const { ctx, pen, scene } = draw;
  const chip = reviewChipOf(review, false);
  const layout = layoutOf(draw, review);
  const top = middle - CHIP_HEIGHT / 2;
  const color = chip.state ? scene.palette.mergeRequestState[chip.state] : scene.palette.reviewStatus[review.status];

  ctx.save();
  ctx.strokeStyle = scene.palette.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  pen.moveTo(left - 3, top + 2.5);
  pen.lineTo(left - 3, top + CHIP_HEIGHT - 2.5);
  ctx.stroke();

  const alpha = ctx.globalAlpha;
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha * (hovered ? HOVER_TINT : TINT);
  ctx.beginPath();
  pen.roundRect(left, top, layout.pill.width, CHIP_HEIGHT, CHIP_HEIGHT / 2);
  ctx.fill();
  ctx.globalAlpha = alpha;

  ctx.strokeStyle = color;
  const glyph = chip.state ? STATE_GLYPHS[chip.state] : STATUS_GLYPHS[review.status];
  pen.strokeGlyph(glyph, left + PILL_GLYPH_X, middle - GLYPH / 2, GLYPH);
  if (layout.pill.text) {
    ctx.font = scene.palette.fonts.badge;
    ctx.textBaseline = 'middle';
    pen.fillText(layout.pill.text.value, left + layout.pill.text.x, middle + 0.5);
  }
  if (layout.icon && chip.status) {
    ctx.strokeStyle = scene.palette.reviewStatus[chip.status];
    pen.strokeGlyph(STATUS_GLYPHS[chip.status], left + layout.icon.x, middle - STATUS_ICON / 2, STATUS_ICON);
  }
  ctx.restore();
  draw.drawn.reviewChips.add(review, left, top, width, CHIP_HEIGHT);
}
