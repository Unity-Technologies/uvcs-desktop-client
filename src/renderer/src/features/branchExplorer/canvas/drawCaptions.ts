import type { NodeLayout } from '../model/layoutGraph';
import { DIMMED_ALPHA, isChangesetDimmed, type DrawContext } from './drawContext';
import { fitText, summaryOf, textWidth } from './fitText';
import { captionLeft, captionMiddle, captionRoom } from './captionPlacement';
import { rowY } from './geometry';

/** Captions never grow wider than this on screen, the workspace changeset's a little more: it's the one people look for. */
const MAX_SCREEN_WIDTH = 240;
const HOME_MAX_SCREEN_WIDTH = 360;
/** Room kept from the right edge of the canvas: a caption reaching it is cut with an ellipsis, never mid-glyph. */
const EDGE_MARGIN = 8;
const WIDTH_STEP = 4;
/** Changesets this far above the screen can still have their caption on it. */
const CAPTION_REACH = 48;

/**
 * The first line of each changeset's comment under it. Drawn in screen coordinates at a fixed size, like map
 * labels, so the tooltip that completes a cut caption can lay the same text exactly over it. Records where
 * each caption was drawn, as wide as its text, for the pointer.
 */
export function drawCaptions(draw: DrawContext): void {
  const { ctx, scene, visible, detail } = draw;
  if (detail.captions === 0) return;
  const { layout, palette } = scene;
  const lastColumn = Math.min(visible.lastColumn, layout.nodesByColumn.length - 1);

  ctx.save();
  ctx.font = palette.fonts.caption;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = palette.background;
  for (let column = Math.max(0, visible.firstColumn); column <= lastColumn; column++) {
    const node = layout.nodesByColumn[column]!;
    const y = rowY(node.row);
    if (y >= visible.top - CAPTION_REACH && y <= visible.bottom) drawCaption(draw, node);
  }
  ctx.restore();
}

function drawCaption(draw: DrawContext, node: NodeLayout): void {
  const { ctx, scene, detail } = draw;
  const { layout, palette, viewport } = scene;
  const summary = !node.collapsed && summaryOf(node.changeset.comment);
  if (!summary) return;

  const left = captionLeft(node) * viewport.zoom + viewport.panX;
  const cap = node.changeset.id === scene.homeChangeset ? HOME_MAX_SCREEN_WIDTH : MAX_SCREEN_WIDTH;
  const maxWidth = Math.min(captionRoom(layout, node) * viewport.zoom, cap, scene.size.width - left - EDGE_MARGIN);
  if (maxWidth <= 12) return;
  // Widths rounded down to a few pixels, so a zoom glide reuses the texts it already fitted.
  const text = fitText(ctx, summary, Math.floor(maxWidth / WIDTH_STEP) * WIDTH_STEP);
  // A lone ellipsis says nothing.
  if (text.length < 2) return;

  const middle = captionMiddle(node, viewport);
  ctx.globalAlpha = detail.captions * (isChangesetDimmed(scene, node.changeset) ? DIMMED_ALPHA : 1);
  ctx.fillStyle = scene.selectedChangeset === node.changeset.id ? palette.textPrimary : palette.textSecondary;
  // A halo in the background color keeps the text readable where links cross it.
  ctx.strokeText(text, left, middle);
  ctx.fillText(text, left, middle);

  const height = palette.captionFontSize + 4;
  draw.drawn.captions.add(
    node,
    (left - viewport.panX) / viewport.zoom,
    (middle - height / 2 - viewport.panY) / viewport.zoom,
    textWidth(ctx, text) / viewport.zoom,
    height / viewport.zoom,
  );
}
