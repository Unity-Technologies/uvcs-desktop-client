import type { MergeLink } from '@shared/domain/branchExplorer';
import type { DrawContext } from './drawContext';
import { linkCurve, pointOnCurve, type Curve } from './curves';
import { NODE_RADIUS } from './geometry';
import { branchColor, mergeLinkDash } from './graphPalette';
import { nodePoint } from './graphTargets';
import { boundsOf, crossesView } from './linkVisibility';

const ARROW_SIZE = 7;
const DOT_RADIUS = 5;

export function drawMergeLinks(draw: DrawContext): void {
  const { scene, visible } = draw;
  for (const link of scene.layout.mergeLinks) {
    const from = nodePoint(scene.layout, link.sourceChangeset)!;
    const to = nodePoint(scene.layout, link.destinationChangeset)!;
    const curve = linkCurve(from, to);
    if (crossesView(boundsOf(curve), visible, NODE_RADIUS + ARROW_SIZE)) drawLink(draw, link, curve);
  }
}

/** Plain merges take the color of the branch they come from; cherry picks and subtractives keep a warning color. */
function linkColor({ scene }: DrawContext, link: MergeLink): string {
  if (link.type !== 'merge') return scene.palette.mergeLinks[link.type];
  const source = scene.layout.nodes.get(link.sourceChangeset);
  return branchColor(scene.palette, source?.changeset.branch ?? '');
}

function drawLink(draw: DrawContext, link: MergeLink, curve: Curve): void {
  const { ctx, scene } = draw;
  const involvesSelection = scene.selectedChangeset === link.sourceChangeset || scene.selectedChangeset === link.destinationChangeset;
  const [from, c1, c2, to] = curve;

  ctx.save();
  ctx.strokeStyle = linkColor(draw, link);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.globalAlpha = involvesSelection ? 1 : 0.7;
  ctx.lineWidth = involvesSelection ? 2.5 : 1.75;
  ctx.lineCap = 'round';
  ctx.setLineDash(mergeLinkDash(link.type));
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, to.x, to.y);
  ctx.stroke();
  ctx.setLineDash([]);
  drawArrowHead(ctx, curve, draw.detail.avatars ? NODE_RADIUS + 4 : DOT_RADIUS + 3);
  ctx.restore();
}

/** An arrow touching the destination changeset, aligned with the end of the curve. */
function drawArrowHead(ctx: CanvasRenderingContext2D, curve: Curve, distanceFromCenter: number): void {
  const tip = pointOnCurve(curve, 1);
  const before = pointOnCurve(curve, 0.95);
  const angle = Math.atan2(tip.y - before.y, tip.x - before.x);
  const x = tip.x - Math.cos(angle) * distanceFromCenter;
  const y = tip.y - Math.sin(angle) * distanceFromCenter;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - ARROW_SIZE * Math.cos(angle - 0.42), y - ARROW_SIZE * Math.sin(angle - 0.42));
  ctx.lineTo(x - ARROW_SIZE * Math.cos(angle + 0.42), y - ARROW_SIZE * Math.sin(angle + 0.42));
  ctx.closePath();
  ctx.fill();
}
