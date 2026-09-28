import type { PendingNode } from '../model/layoutGraph';
import { arrowLength, drawArrowHead, lineUnderHead } from './drawArrowHead';
import { STRUCTURE_DIMMED_ALPHA, type DrawContext } from './drawContext';
import { arrivalAt, curveUntil, pendingParentCurve, reversed } from './curves';
import { NODE_RADIUS, nodePoint, pendingPoint } from './geometry';
import { branchColor } from './graphPalette';
import { nextColumnOnRow } from './rowNeighbors';

const DOT_RADIUS = 5;
const RING_DASH = [4, 3];
const COMPACT_RING_DASH = [2, 2];
const LINE_DASH = [3, 3];
/** The parent line's arrowhead, pointing back at the loaded changeset: the same head as every parent line's. */
const PARENT_ARROW = arrowLength(2);

/**
 * The workspace's pending changes as the changeset they will become: a dashed, empty ring on the workspace's branch
 * (counting the changes when there is room), with a dashed line back to the loaded changeset, as the official client
 * draws its checkout changeset. It is never a hit: while searching it recedes with the rest.
 */
export function drawPendingChangeset(draw: DrawContext, pending: PendingNode): void {
  const { ctx, pen, scene, detail } = draw;
  const point = pendingPoint(scene.layout)!;
  const color = branchColor(scene.palette, pending.branch);
  const radius = detail.avatars ? NODE_RADIUS : DOT_RADIUS;
  const alpha = scene.search ? STRUCTURE_DIMMED_ALPHA : 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  drawParentLine(draw, pending, color, radius);
  // An opaque disc: the lines into it end behind it.
  ctx.fillStyle = scene.palette.background;
  ctx.beginPath();
  pen.arc(point.x, point.y, radius + 2, 0, Math.PI * 2);
  ctx.fill();
  if (scene.hoveredPending) {
    ctx.globalAlpha = alpha * 0.14;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = alpha;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = scene.hoveredPending ? 3 : 2;
  ctx.setLineDash(detail.avatars ? RING_DASH : COMPACT_RING_DASH);
  ctx.beginPath();
  pen.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  if (detail.text && scene.pendingChangeCount > 0) {
    ctx.font = scene.palette.fonts.collapsed;
    ctx.fillStyle = scene.hoveredPending ? scene.palette.textPrimary : scene.palette.textSecondary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    pen.fillText(scene.pendingChangeCount > 99 ? '99+' : String(scene.pendingChangeCount), point.x, point.y + 0.5);
  }
  ctx.restore();
}

/**
 * The line back to the loaded changeset, when it is on the same branch (a branch without changesets starts from it
 * with its elbow instead): along the band, or arching over the changesets the branch got since.
 */
function drawParentLine(draw: DrawContext, pending: PendingNode, color: string, radius: number): void {
  const { ctx, pen, scene, detail } = draw;
  const parent = scene.layout.nodes.get(pending.parent);
  if (!parent || parent.changeset.branch !== pending.branch) return;
  const overChangesets = nextColumnOnRow(scene.layout, parent.column) !== pending.column;
  // Drawn from the pending changeset back to its parent, where the arrowhead points.
  const curve = reversed(pendingParentCurve(nodePoint(scene.layout, pending.parent)!, pendingPoint(scene.layout)!, overChangesets));
  const tipDistance = radius + 2;
  const tip = arrivalAt(curve, tipDistance);
  const base = arrivalAt(curve, tipDistance + PARENT_ARROW);
  const [from, c1, c2, end] = detail.text ? curveUntil(curve, arrivalAt(curve, tipDistance + PARENT_ARROW - lineUnderHead(draw)).t) : curve;

  ctx.save();
  ctx.globalAlpha *= 0.7;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'butt';
  ctx.setLineDash(LINE_DASH);
  ctx.beginPath();
  pen.moveTo(from.x, from.y);
  pen.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
  ctx.stroke();
  ctx.setLineDash([]);
  if (detail.text) drawArrowHead(draw, tip, base);
  ctx.restore();
}
