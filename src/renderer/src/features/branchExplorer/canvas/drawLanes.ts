import { shortBranchName } from '@shared/domain/specs';
import type { Lane } from '../model/layoutGraph';
import type { DrawContext } from './drawContext';
import { branchStartCurve } from './curves';
import { COLUMN_WIDTH, columnX, rowY } from './geometry';
import { branchColor } from './graphPalette';
import { nodePoint } from './graphTargets';

const LANE_WIDTH = 3;
/** How far into its lane a branch's start curve lands after leaving the base changeset. */
const START_OFFSET = COLUMN_WIDTH * 0.6;
/** Even an empty branch gets a short visible stub. */
const MINIMUM_LENGTH = COLUMN_WIDTH * 0.4;

/** The horizontal part of a lane, in world coordinates. */
function laneLine(lane: Lane): { startX: number; endX: number; y: number } {
  const startX = columnX(lane.startColumn) + (lane.baseChangeset !== null ? START_OFFSET : 0);
  return { startX, endX: Math.max(columnX(lane.endColumn), startX + MINIMUM_LENGTH), y: rowY(lane.row) };
}

export function drawLanes(draw: DrawContext): void {
  const { scene, visible } = draw;
  for (const lane of scene.layout.lanes) {
    const line = laneLine(lane);
    const offScreen =
      line.endX < visible.left - 40 || columnX(lane.startColumn) > visible.right + 40 || line.y < visible.top - 60 || line.y > visible.bottom + 60;
    if (offScreen) continue;

    const color = branchColor(scene.palette, lane.branch.name);
    const selected = scene.selectedBranch === lane.branch.name;
    drawLaneLine(draw, lane, color, selected);
    if (draw.showText) drawCaption(draw, lane, color, selected);
  }
}

function drawLaneLine({ ctx, scene }: DrawContext, lane: Lane, color: string, selected: boolean): void {
  const { startX, endX, y } = laneLine(lane);
  const base = lane.baseChangeset !== null ? nodePoint(scene.layout, lane.baseChangeset) : null;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.globalAlpha = selected ? 0.9 : 0.45;
  ctx.lineWidth = selected ? LANE_WIDTH + 2 : LANE_WIDTH;
  ctx.beginPath();
  if (base) {
    const [from, c1, c2, to] = branchStartCurve(base, { x: startX, y });
    ctx.moveTo(from.x, from.y);
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, to.x, to.y);
  } else {
    ctx.moveTo(startX, y);
  }
  ctx.lineTo(endX, y);
  ctx.stroke();
  ctx.restore();
}

/** The branch name under its lane, kept visible at the left edge while the lane is on screen. */
function drawCaption({ ctx, scene, visible }: DrawContext, lane: Lane, color: string, selected: boolean): void {
  const { startX, endX, y } = laneLine(lane);
  const stickyLeft = visible.left + 12 / scene.viewport.zoom;
  const x = Math.max(startX, Math.min(stickyLeft, endX - 60));

  ctx.save();
  ctx.font = `${selected ? 600 : 500} 11px ${scene.palette.fontUi}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(lane.branch.parent ? shortBranchName(lane.branch.name) : lane.branch.name, x, y + 20);
  ctx.restore();
}
