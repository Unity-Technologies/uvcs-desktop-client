import type { MergeLink, MergeLinkType } from '@shared/domain/branchExplorer';
import { arrowLength, drawArrowHead, lineUnderHead } from './drawArrowHead';
import { STRUCTURE_DIMMED_ALPHA, type DrawContext } from './drawContext';
import { arrivalAt, curveUntil, linkCurve, type Curve } from './curves';
import { NODE_RADIUS, nodePoint, pendingPoint } from './geometry';
import { branchColor, mergeLinkDash, PENDING_LINK_DASH } from './graphPalette';
import { boundsOf, crossesView } from './linkVisibility';
import { mergeLinksAcross } from './spansInView';

const ARROW_SIZE = arrowLength(2.5);
const DOT_RADIUS = 5;
const MARGIN = NODE_RADIUS + ARROW_SIZE;

export function drawMergeLinks(draw: DrawContext): void {
  const { scene, visible } = draw;
  for (const link of mergeLinksAcross(scene.layout, visible.left - MARGIN, visible.right + MARGIN)) {
    const from = nodePoint(scene.layout, link.sourceChangeset)!;
    const to = nodePoint(scene.layout, link.destinationChangeset)!;
    const curve = linkCurve(from, to);
    if (!crossesView(boundsOf(curve), visible, MARGIN)) continue;
    const { search, selectedChangeset, hoveredChangeset } = scene;
    // While searching, a link stays lit only between two hits; the rest recede with the changesets they join.
    drawLink(draw, curve, {
      color: linkColor(draw, link),
      dash: mergeLinkDash(link.type),
      cap: 'butt',
      emphasized: involves(link, selectedChangeset) || involves(link, hoveredChangeset),
      lit: !search || (search.changesets.has(link.sourceChangeset) && search.changesets.has(link.destinationChangeset)),
    });
  }
}

/**
 * The merges in progress, into the pending changeset: styled as the links they will be once checked in, but dotted.
 * They recede while searching, as the pending changeset is never a hit.
 */
export function drawPendingMergeLinks(draw: DrawContext): void {
  const { scene, visible } = draw;
  const to = pendingPoint(scene.layout);
  if (!to) return;
  for (const link of scene.layout.pending!.mergeLinks) {
    const curve = linkCurve(nodePoint(scene.layout, link.sourceChangeset)!, to);
    if (!crossesView(boundsOf(curve), visible, MARGIN)) continue;
    drawLink(draw, curve, {
      color: linkColor(draw, link),
      dash: PENDING_LINK_DASH,
      // Zero-length dashes with round caps: dots.
      cap: 'round',
      emphasized: scene.hoveredPending || scene.hoveredChangeset === link.sourceChangeset || scene.selectedChangeset === link.sourceChangeset,
      lit: !scene.search,
    });
  }
}

/** Plain merges take the color of the branch they come from; cherry picks and subtractives keep a warning color. */
function linkColor({ scene }: DrawContext, link: { type: MergeLinkType; sourceChangeset: number }): string {
  if (link.type !== 'merge') return scene.palette.mergeLinks[link.type];
  const source = scene.layout.nodes.get(link.sourceChangeset);
  return branchColor(scene.palette, source?.changeset.branch ?? '');
}

interface LinkStyle {
  color: string;
  dash: number[];
  cap: CanvasLineCap;
  emphasized: boolean;
  lit: boolean;
}

function drawLink(draw: DrawContext, curve: Curve, { color, dash, cap, emphasized, lit }: LinkStyle): void {
  const { ctx, pen } = draw;
  const [from] = curve;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = emphasized ? 1 : lit ? 0.75 : STRUCTURE_DIMMED_ALPHA;
  const lineWidth = emphasized ? 2.5 : 2;
  const length = arrowLength(lineWidth);
  const tipDistance = draw.detail.avatars ? NODE_RADIUS + 4 : DOT_RADIUS + 3;
  // Tip and base both on the curve: the head follows the curve's arrival and the line meets the middle of its base.
  const tip = arrivalAt(curve, tipDistance);
  const base = arrivalAt(curve, tipDistance + length);
  const [, c1, c2, end] = curveUntil(curve, arrivalAt(curve, tipDistance + length - lineUnderHead(draw)).t);
  ctx.lineWidth = lineWidth;
  ctx.lineCap = cap;
  ctx.setLineDash(dash);
  ctx.beginPath();
  pen.moveTo(from.x, from.y);
  pen.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
  ctx.stroke();
  ctx.setLineDash(NO_DASH);
  drawArrowHead(draw, tip, base);
  ctx.restore();
}

const NO_DASH: number[] = [];

function involves(link: MergeLink, changeset: number | null): boolean {
  return changeset === link.sourceChangeset || changeset === link.destinationChangeset;
}
