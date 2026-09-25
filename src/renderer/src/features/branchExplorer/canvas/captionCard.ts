/** Font metrics of the caption face, to lay DOM text exactly over canvas text. */
export interface CaptionMetrics {
  /** Font-box ascent and descent: what CSS line layout uses as the content area. */
  ascent: number;
  descent: number;
  /** From the canvas 'middle' anchor down to the alphabetic baseline. */
  middleToBaseline: number;
}

/** The card's box, mirrored from GraphTooltip.module.css (.card): they offset its first glyph from its corner. */
export const CARD_BORDER = 1;
export const CARD_PADDING_X = 9;
export const CARD_PADDING_Y = 6;
export const CARD_LINE_HEIGHT = 1.45;
/** A comfortable reading measure on large windows, never more than a quarter of a small one. */
const CARD_MAX_WIDTH = 420;
const CARD_MIN_WIDTH = 300;
const EDGE_MARGIN = 8;

export function cardMaxWidth(windowWidth: number): number {
  return Math.min(CARD_MAX_WIDTH, Math.max(CARD_MIN_WIDTH, Math.round(windowWidth / 4)));
}

/**
 * Where the card that completes a cut caption goes, so its first line lands exactly on the caption's glyphs and
 * the text appears to complete itself in place. The canvas anchors the caption at its middle; a DOM line puts its
 * text at half-leading plus ascent: both meet at the alphabetic baseline.
 */
export function captionCardPosition(caption: { x: number; middle: number }, metrics: CaptionMetrics, fontSize: number): { left: number; top: number } {
  const halfLeading = (fontSize * CARD_LINE_HEIGHT - (metrics.ascent + metrics.descent)) / 2;
  const baseline = caption.middle + metrics.middleToBaseline;
  return {
    left: caption.x - CARD_BORDER - CARD_PADDING_X,
    top: baseline - metrics.ascent - halfLeading - CARD_PADDING_Y - CARD_BORDER,
  };
}

/** A card's left edge moved just enough to keep it inside the canvas: alignment yields to visibility at the edges. */
export function keepInside(left: number, width: number, containerWidth: number): number {
  return Math.max(EDGE_MARGIN, Math.min(left, containerWidth - width - EDGE_MARGIN));
}

const metricsByFont = new Map<string, CaptionMetrics>();

/** Measures the caption font once per font: guessed offsets drift by a pixel across platforms. */
export function captionMetrics(font: string, fontSize: number): CaptionMetrics {
  let metrics = metricsByFont.get(font);
  if (metrics) return metrics;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return { ascent: fontSize * 0.96, descent: fontSize * 0.25, middleToBaseline: fontSize * 0.3 };
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  const fromBaseline = ctx.measureText('Mg');
  ctx.textBaseline = 'middle';
  const fromMiddle = ctx.measureText('Mg');
  metrics = {
    ascent: fromBaseline.fontBoundingBoxAscent,
    descent: fromBaseline.fontBoundingBoxDescent,
    // Metrics are relative to the active baseline: the difference of the ascents is the middle-to-baseline distance.
    middleToBaseline: fromBaseline.fontBoundingBoxAscent - fromMiddle.fontBoundingBoxAscent,
  };
  metricsByFont.set(font, metrics);
  return metrics;
}
