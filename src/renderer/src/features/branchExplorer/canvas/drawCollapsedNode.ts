import type { NodeLayout } from '../model/layoutGraph';
import { DIMMED_ALPHA, type DrawContext } from './drawContext';
import { COLLAPSED_NODE_HALF_WIDTH, columnX, rowY } from './geometry';
import { branchColor } from './graphPalette';

const HEIGHT = 18;
const COMPACT_HEIGHT = 10;

/** A "+N" pill on the band where "Only relevant changesets" collapsed a run; zoomed out, a short bar. */
export function drawCollapsedNode({ ctx, scene, detail }: DrawContext, node: NodeLayout, hovered: boolean): void {
  const { palette } = scene;
  const count = node.collapsed!.length;
  const x = columnX(node.column);
  const y = rowY(node.row);
  const color = branchColor(palette, node.changeset.branch);
  const text = `+${count}`;

  ctx.save();
  ctx.globalAlpha = scene.search ? DIMMED_ALPHA : 1;
  ctx.font = `600 10px ${palette.fontUi}`;
  const height = detail.text ? HEIGHT : COMPACT_HEIGHT;
  const width = detail.text ? Math.min(COLLAPSED_NODE_HALF_WIDTH * 2, ctx.measureText(text).width + 14) : 16;
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - height / 2, width, height, height / 2);
  ctx.fillStyle = palette.background;
  ctx.fill();
  if (hovered) {
    ctx.globalAlpha *= 0.14;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = scene.search ? DIMMED_ALPHA : 1;
  }
  ctx.setLineDash([3, 2]);
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
