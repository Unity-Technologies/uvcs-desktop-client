import type { ReviewChip } from '../../codeReviews/reviewChip';
import { SHORT_STATUS } from '../../codeReviews/reviewsByBranch';

/** A pill's height, its side padding, a glyph's size and the gap after it, in world px. */
export const CHIP_HEIGHT = 15;
const PAD_X = 5;
export const GLYPH = 9;
const GLYPH_GAP = 3;
/** Between the pill and the review's icon after it. */
const AFTER_PILL = 4;
/** The verdict's icon after a merge request's pill, a little larger: it stands alone. */
export const STATUS_ICON = 11;

/**
 * Where each part of a branch's review chip goes on the canvas, as the lists draw it (`CodeReviewChip`): a tinted
 * pill with a glyph and a name (a merge request's state, else a code review's status), then, for a merge request, its
 * verdict's icon alone (`listedVerdictOf`). Offsets from the chip's left; one layout for measuring and drawing, so they never disagree.
 */
export interface ReviewChipLayout {
  pill: { kind: 'state' | 'status'; width: number; text?: { x: number; value: string } };
  /** The verdict's icon after the pill. */
  icon?: { x: number };
  width: number;
}

export function reviewChipLayout(chip: ReviewChip, measure: (text: string) => number): ReviewChipLayout {
  const pillText = chip.state ? (chip.stateText ? chip.state : undefined) : chip.status && chip.statusText ? SHORT_STATUS[chip.status] : undefined;
  const textX = PAD_X + GLYPH + GLYPH_GAP;
  const pillWidth = pillText ? textX + measure(pillText) + PAD_X : PAD_X * 2 + GLYPH;
  const pill = { kind: chip.state ? ('state' as const) : ('status' as const), width: pillWidth, ...(pillText && { text: { x: textX, value: pillText } }) };
  if (chip.verdict) {
    const iconX = pillWidth + AFTER_PILL;
    return { pill, icon: { x: iconX }, width: iconX + STATUS_ICON };
  }
  return { pill, width: pillWidth };
}

/** Where a glyph sits in the pill. */
export const PILL_GLYPH_X = PAD_X;
