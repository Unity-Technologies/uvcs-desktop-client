import type { Lane } from '../model/layoutGraph';
import { STRUCTURE_DIMMED_ALPHA, type DrawContext } from './drawContext';
import { BAND_HEIGHT, NODE_RADIUS, nodePoint } from './geometry';
import { branchColor } from './graphPalette';
import { laneShape, type LaneShape } from './laneShape';
import { boundsOf, crossesView } from './linkVisibility';
import { lanesAcross } from './spansInView';

const ELBOW_RADIUS = 16;
/** The selection wraps the band like it wraps a changeset: a soft halo and an accent ring. */
const SELECTION_HALO = 6;
const SELECTION_RING = 3;
/** What of a band past the screen edges is still drawn: more than its rounded end with the selection around it. */
const VIEW_MARGIN = BAND_HEIGHT + SELECTION_HALO;

/** Branch bands, and the elbow each branch draws from its base changeset on the parent's band. */
export function drawLanes(draw: DrawContext): void {
  const { scene, visible } = draw;
  for (const lane of lanesAcross(scene.layout, visible.left - VIEW_MARGIN, visible.right + VIEW_MARGIN)) {
    const shape = laneShape(lane);
    const base = lane.baseChangeset !== null ? nodePoint(scene.layout, lane.baseChangeset) : null;
    // The band and the whole elbow down from its base: the elbow stays while it crosses the screen.
    const bounds = boundsOf([{ x: shape.left, y: shape.y }, { x: shape.right, y: shape.y }, ...(base ? [base] : [])]);
    if (!crossesView(bounds, visible, VIEW_MARGIN)) continue;

    const color = branchColor(scene.palette, lane.branch.name);
    if (base) drawBranchStart(draw, lane, base, shape, color);
    drawBand(draw, lane, shape, color);
  }
}

function drawBand(draw: DrawContext, lane: Lane, shape: LaneShape, color: string): void {
  const { ctx, scene, visible } = draw;
  const name = lane.branch.name;
  const isCurrent = scene.currentBranch === name;
  const isSelected = scene.selectedBranch === name;
  const isHovered = scene.hoveredBranch === name;
  // While a search picks changesets out, the bands recede, unless they hold a hit.
  const recedes = scene.search !== null && !scene.search.litBranches.has(name);
  const top = shape.y - BAND_HEIGHT / 2;
  // Only the part on screen: /main's band runs across the whole history, millions of px.
  const left = Math.max(shape.left, visible.left - VIEW_MARGIN);
  const width = Math.min(shape.right, visible.right + VIEW_MARGIN) - left;
  const radius = BAND_HEIGHT / 2;

  ctx.save();
  if (isSelected) {
    ctx.fillStyle = scene.palette.accentSoft;
    roundRect(draw, left, top, width, BAND_HEIGHT, radius, SELECTION_HALO);
    ctx.fill();
  }
  roundRect(draw, left, top, width, BAND_HEIGHT, radius, 0);
  ctx.fillStyle = color;
  ctx.globalAlpha = (scene.palette.isDark ? 0.1 : 0.06) + (isCurrent ? 0.03 : 0) + (isHovered ? 0.04 : 0);
  if (recedes) ctx.globalAlpha *= 0.5;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.globalAlpha = (isCurrent ? 0.6 : isHovered ? 0.5 : 0.3) * (recedes ? 0.4 : 1);
  ctx.lineWidth = isCurrent ? 1.5 : 1;
  ctx.stroke();
  if (isSelected) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = scene.palette.accent;
    ctx.lineWidth = 2;
    roundRect(draw, left, top, width, BAND_HEIGHT, radius, SELECTION_RING);
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect({ ctx, pen }: DrawContext, left: number, top: number, width: number, height: number, radius: number, grow: number): void {
  ctx.beginPath();
  pen.roundRect(left - grow, top - grow, width + grow * 2, height + grow * 2, radius + grow);
}

/** Down from the base changeset, a rounded turn, then right into the band. */
function drawBranchStart({ ctx, pen, scene }: DrawContext, lane: Lane, base: { x: number; y: number }, shape: LaneShape, color: string): void {
  const radius = Math.max(4, Math.min(ELBOW_RADIUS, shape.left - base.x, shape.y - base.y - NODE_RADIUS));
  const recedes = scene.search !== null && !scene.search.litBranches.has(lane.branch.name);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = recedes ? STRUCTURE_DIMMED_ALPHA : 0.8;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  pen.moveTo(base.x, base.y + NODE_RADIUS);
  pen.lineTo(base.x, shape.y - radius);
  pen.arcTo(base.x, shape.y, base.x + radius, shape.y, radius);
  pen.lineTo(shape.left, shape.y);
  ctx.stroke();
  ctx.restore();
}
