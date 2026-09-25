import type { MergeLink } from '@shared/domain/branchExplorer';
import type { DrawContext } from './drawContext';
import { linkCurve, pointOnCurve, type Curve } from './curves';
import { NODE_RADIUS } from './geometry';
import { mergeLinkDash } from './graphPalette';
import { nodePoint } from './graphTargets';

const ARROW_SIZE = 6;

export function drawMergeLinks(draw: DrawContext): void {
  const { scene, visible } = draw;
  for (const link of scene.layout.mergeLinks) {
    const from = nodePoint(scene.layout, link.sourceChangeset)!;
    const to = nodePoint(scene.layout, link.destinationChangeset)!;
    const offScreen =
      Math.max(from.x, to.x) < visible.left ||
      Math.min(from.x, to.x) > visible.right ||
      Math.max(from.y, to.y) < visible.top ||
      Math.min(from.y, to.y) > visible.bottom;
    if (!offScreen) drawLink(draw, link, linkCurve(from, to));
  }
}

function drawLink({ ctx, scene }: DrawContext, link: MergeLink, curve: Curve): void {
  const involvesSelection = scene.selectedChangeset === link.sourceChangeset || scene.selectedChangeset === link.destinationChangeset;
  const [from, c1, c2, to] = curve;

  ctx.save();
  ctx.strokeStyle = scene.palette.mergeLinks[link.type];
  ctx.fillStyle = ctx.strokeStyle;
  ctx.globalAlpha = involvesSelection ? 1 : 0.7;
  ctx.lineWidth = involvesSelection ? 2.5 : 1.6;
  ctx.setLineDash(mergeLinkDash(link.type));
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, to.x, to.y);
  ctx.stroke();
  ctx.setLineDash([]);
  drawArrowHead(ctx, curve);
  ctx.restore();
}

/** An arrow touching the destination node, aligned with the end of the curve. */
function drawArrowHead(ctx: CanvasRenderingContext2D, curve: Curve): void {
  const tip = pointOnCurve(curve, 1);
  const before = pointOnCurve(curve, 0.96);
  const angle = Math.atan2(tip.y - before.y, tip.x - before.x);
  const x = tip.x - Math.cos(angle) * (NODE_RADIUS + 1);
  const y = tip.y - Math.sin(angle) * (NODE_RADIUS + 1);

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - ARROW_SIZE * Math.cos(angle - 0.45), y - ARROW_SIZE * Math.sin(angle - 0.45));
  ctx.lineTo(x - ARROW_SIZE * Math.cos(angle + 0.45), y - ARROW_SIZE * Math.sin(angle + 0.45));
  ctx.closePath();
  ctx.fill();
}
