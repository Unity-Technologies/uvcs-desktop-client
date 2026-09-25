import type { NodeLayout } from '../model/layoutGraph';
import { DIMMED_ALPHA, type DrawContext } from './drawContext';
import { textWidth } from './fitText';
import { COLLAPSED_NODE_HALF_WIDTH, columnX, rowY } from './geometry';
import { branchColor } from './graphPalette';

const HEIGHT = 18;
const COMPACT_HEIGHT = 10;
const DASH = [3, 2];

/** A "+N" pill on the band where "Only relevant changesets" collapsed a run; zoomed out, a short bar. */
export function drawCollapsedNode({ ctx, scene, detail }: DrawContext, node: NodeLayout, hovered: boolean): void {
  const { palette } = scene;
  const count = node.collapsed!.length;
  const x = columnX(node.column);
  const y = rowY(node.row);
  const color = branchColor(palette, node.changeset.branch);
  const text = `+${count}`;
  const ink = scene.search ? DIMMED_ALPHA : 1;

  ctx.save();
  ctx.font = palette.fonts.collapsed;
  const height = detail.text ? HEIGHT : COMPACT_HEIGHT;
  const width = detail.text ? Math.min(COLLAPSED_NODE_HALF_WIDTH * 2, textWidth(ctx, text) + 14) : 16;
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - height / 2, width, height, height / 2);
  // Opaque, so the band's line never runs through it, even faded.
  ctx.fillStyle = palette.background;
  ctx.fill();
  if (hovered) {
    ctx.globalAlpha = ink * 0.14;
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.globalAlpha = ink;
  ctx.setLineDash(DASH);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = color;
  ctx.stroke();
  if (detail.text) {
    ctx.fillStyle = hovered ? palette.textPrimary : palette.textSecondary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
  }
  ctx.restore();
}
