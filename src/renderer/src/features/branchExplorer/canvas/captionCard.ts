import type { Viewport } from './viewport';

/** Font metrics of the caption face: where its baseline goes and how tall its text box is. */
export interface CaptionMetrics {
  /** Font-box ascent and descent: what CSS line layout uses as the content area. */
  ascent: number;
  descent: number;
  /** From the canvas 'middle' anchor down to the alphabetic baseline. */
  middleToBaseline: number;
}

/** From the card's corner to its text, mirrored from GraphTooltip.module.css (.card: border and padding). */
const CARD_INSET_X = 1 + 9;
/** A comfortable reading measure on large windows, never more than a quarter of a small one. */
const CARD_MAX_WIDTH = 420;
const CARD_MIN_WIDTH = 300;
/** Narrower than this, a card over a caption near the right edge moves left rather than wrap in a thin column. */
const CAPTION_CARD_MIN_ROOM = 200;
const EDGE_MARGIN = 8;

export function cardMaxWidth(windowWidth: number): number {
  return Math.min(CARD_MAX_WIDTH, Math.max(CARD_MIN_WIDTH, Math.round(windowWidth / 4)));
}

/**
 * How wide the card over a caption may grow. Its text must start exactly on the caption's first glyph, so near the
 * right edge it wraps in the room left instead of moving; only when that room is too narrow to read does it move.
 */
export function captionCardMaxWidth(captionX: number, containerWidth: number, windowWidth: number): number {
  const widest = cardMaxWidth(windowWidth);
  const room = containerWidth - EDGE_MARGIN - (captionX - CARD_INSET_X);
  return room >= CAPTION_CARD_MIN_ROOM ? Math.min(widest, room) : widest;
}

/**
 * Where the card over a caption goes so that its text, measured `origin` in from its corner, starts on the
 * caption's first glyph and sits on its baseline: the cut comment appears to complete itself in place.
 */
export function captionCardCorner(caption: { x: number; baseline: number }, origin: { x: number; y: number }): { left: number; top: number } {
  return { left: caption.x - origin.x, top: caption.baseline - origin.y };
}

/** Where on screen a caption drawn at `caption` (world px, its top-left) has its first glyph and its baseline. */
export function captionOnScreen(caption: { x: number; y: number }, viewport: Viewport, ascent: number): { x: number; baseline: number } {
  return { x: caption.x * viewport.zoom + viewport.panX, baseline: caption.y * viewport.zoom + viewport.panY + ascent };
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
