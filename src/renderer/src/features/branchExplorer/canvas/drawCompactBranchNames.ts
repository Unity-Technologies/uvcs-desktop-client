import { compactNameWidth } from './compactNameWidth';
import { GHOST_ALPHA, type DrawContext } from './drawContext';
import { fitBranchName, textWidth } from './fitText';
import { BAND_HEIGHT, ROW_HEIGHT } from './geometry';
import { branchInk } from './graphPalette';
import { laneShape, roomBeforeNextLane } from './laneShape';
import { lanesAcross } from './spansInView';
import { drawSearchMarks, redrawMarkedLetters } from './searchMarks';

/** Rows closer than this on screen are too crowded for names. */
const MIN_ROW_SPACING_FOR_NAMES = 24;
const COMPACT_NAME_HEIGHT = 13;

/**
 * Zoomed out, cards would be unreadably small: branch names are drawn at a fixed screen size
 * just above each band instead, as long as the rows are not too crowded. Drawn in screen coordinates.
 */
export function drawCompactBranchNames(draw: DrawContext): void {
  const { ctx, scene, visible } = draw;
  const { viewport, palette, search } = scene;
  if (ROW_HEIGHT * viewport.zoom < MIN_ROW_SPACING_FOR_NAMES) return;

  ctx.save();
  ctx.font = palette.fonts.compactBranchName;
  ctx.textBaseline = 'bottom';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = palette.background;
  for (const lane of lanesAcross(scene.layout, visible.left, visible.right)) {
    const shape = laneShape(lane);
    if (shape.right < visible.left || shape.left > visible.right || shape.y < visible.top || shape.y > visible.bottom) continue;

    const left = Math.max(shape.left * viewport.zoom + viewport.panX, 6);
    const right = shape.right * viewport.zoom + viewport.panX;
    const bottom = (shape.y - BAND_HEIGHT / 2) * viewport.zoom + viewport.panY - 3;
    const room = compactNameWidth(left, right, roomBeforeNextLane(scene.layout, lane, shape.left) * viewport.zoom, scene.size.width);
    const name = fitBranchName(ctx, lane.branch.name, room);
    ctx.globalAlpha = search && !search.litBranches.has(lane.branch.name) ? GHOST_ALPHA : 1;
    drawSearchMarks(draw, name, left, bottom - COMPACT_NAME_HEIGHT / 2 + 1, COMPACT_NAME_HEIGHT + 1);
    ctx.strokeText(name, left, bottom);
    ctx.fillStyle = scene.currentBranch === lane.branch.name ? palette.accentText : branchInk(palette, lane.branch.name);
    ctx.fillText(name, left, bottom);
    redrawMarkedLetters(draw, name, left, bottom);
    draw.drawn.branchHeaders.add(
      lane,
      (left - viewport.panX) / viewport.zoom,
      (bottom - COMPACT_NAME_HEIGHT - viewport.panY) / viewport.zoom,
      textWidth(ctx, name) / viewport.zoom,
      COMPACT_NAME_HEIGHT / viewport.zoom,
    );
  }
  ctx.restore();
}
