import type { MergeLink } from '@shared/domain/branchExplorer';
import { arrowLength, drawArrowHead, lineUnderHead } from './drawArrowHead';
import { STRUCTURE_DIMMED_ALPHA, type DrawContext } from './drawContext';
import { arrivalAt, curveUntil, linkCurve, type Curve } from './curves';
import { NODE_RADIUS, nodePoint } from './geometry';
import { branchColor, mergeLinkDash } from './graphPalette';
import { boundsOf, crossesView } from './linkVisibility';
import { mergeLinksAcross } from './spansInView';

const ARROW_SIZE = arrowLength(2.5);
const DOT_RADIUS = 5;

export function drawMergeLinks(draw: DrawContext): void {
  const { scene, visible } = draw;
  const margin = NODE_RADIUS + ARROW_SIZE;
  for (const link of mergeLinksAcross(scene.layout, visible.left - margin, visible.right + margin)) {
    const from = nodePoint(scene.layout, link.sourceChangeset)!;
    const to = nodePoint(scene.layout, link.destinationChangeset)!;
    const curve = linkCurve(from, to);
    if (crossesView(boundsOf(curve), visible, margin)) drawLink(draw, link, curve);
  }
}

/** Plain merges take the color of the branch they come from; cherry picks and subtractives keep a warning color. */
function linkColor({ scene }: DrawContext, link: MergeLink): string {
  if (link.type !== 'merge') return scene.palette.mergeLinks[link.type];
  const source = scene.layout.nodes.get(link.sourceChangeset);
  return branchColor(scene.palette, source?.changeset.branch ?? '');
}

function drawLink(draw: DrawContext, link: MergeLink, curve: Curve): void {
  const { ctx, pen, scene } = draw;
  const emphasized = involves(link, scene.selectedChangeset) || involves(link, scene.hoveredChangeset);
  // While searching, a link stays lit only between two hits; the rest recede with the changesets they join.
  const { search } = scene;
  const lit = !search || (search.changesets.has(link.sourceChangeset) && search.changesets.has(link.destinationChangeset));
  const [from] = curve;

  ctx.save();
  ctx.strokeStyle = linkColor(draw, link);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.globalAlpha = emphasized ? 1 : lit ? 0.75 : STRUCTURE_DIMMED_ALPHA;
  const lineWidth = emphasized ? 2.5 : 2;
  const length = arrowLength(lineWidth);
  const tipDistance = draw.detail.avatars ? NODE_RADIUS + 4 : DOT_RADIUS + 3;
  // Tip and base both on the curve: the head follows the curve's arrival and the line meets the middle of its base.
  const tip = arrivalAt(curve, tipDistance);
  const base = arrivalAt(curve, tipDistance + length);
  const [, c1, c2, end] = curveUntil(curve, arrivalAt(curve, tipDistance + length - lineUnderHead(draw)).t);
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'butt';
  ctx.setLineDash(mergeLinkDash(link.type));
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
