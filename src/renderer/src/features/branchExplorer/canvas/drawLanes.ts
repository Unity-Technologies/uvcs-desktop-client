import type { Lane } from '../model/layoutGraph';
import type { DrawContext } from './drawContext';
import { BAND_HEIGHT, NODE_RADIUS } from './geometry';
import { branchColor } from './graphPalette';
import { nodePoint } from './graphTargets';
import { laneShape, type LaneShape } from './laneShape';
import { boundsOf, crossesView } from './linkVisibility';

const ELBOW_RADIUS = 16;

/** Branch bands, and the elbow each branch draws from its base changeset on the parent's band. */
export function drawLanes(draw: DrawContext): void {
  const { scene, visible } = draw;
  for (const lane of scene.layout.lanes) {
    const shape = laneShape(lane);
    const base = lane.baseChangeset !== null ? nodePoint(scene.layout, lane.baseChangeset) : null;
    // The band and the whole elbow down from its base: the elbow stays while it crosses the screen.
    const bounds = boundsOf([{ x: shape.left, y: shape.y }, { x: shape.right, y: shape.y }, ...(base ? [base] : [])]);
    if (!crossesView(bounds, visible, BAND_HEIGHT)) continue;

    const color = branchColor(scene.palette, lane.branch.name);
    if (base) drawBranchStart(draw, base, shape, color);
    drawBand(draw, lane, shape, color);
  }
}

function drawBand({ ctx, scene }: DrawContext, lane: Lane, shape: LaneShape, color: string): void {
  const isCurrent = scene.currentBranch === lane.branch.name;
  const isSelected = scene.selectedBranch === lane.branch.name;
  const height = BAND_HEIGHT;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(shape.left, shape.y - height / 2, shape.right - shape.left, height, height / 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = (scene.palette.isDark ? 0.14 : 0.1) + (isCurrent ? 0.08 : 0) + (isSelected ? 0.06 : 0);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.globalAlpha = isSelected ? 0.95 : isCurrent ? 0.75 : 0.3;
  ctx.lineWidth = isSelected || isCurrent ? 1.5 : 1;
  ctx.stroke();
  ctx.restore();
}

/** Down from the base changeset, a rounded turn, then right into the band. */
function drawBranchStart({ ctx }: DrawContext, base: { x: number; y: number }, shape: LaneShape, color: string): void {
  const radius = Math.max(4, Math.min(ELBOW_RADIUS, shape.left - base.x, shape.y - base.y - NODE_RADIUS));

  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(base.x, base.y + NODE_RADIUS);
  ctx.lineTo(base.x, shape.y - radius);
  ctx.arcTo(base.x, shape.y, base.x + radius, shape.y, radius);
  ctx.lineTo(shape.left, shape.y);
  ctx.stroke();
  ctx.restore();
}
