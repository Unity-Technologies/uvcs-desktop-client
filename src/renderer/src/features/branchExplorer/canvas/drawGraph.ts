import { COLUMN_WIDTH, GRAPH_PADDING } from './geometry';
import { detailLevel, type DrawContext, type DrawnReviewChip, type GraphScene, type VisibleArea } from './drawContext';
import { drawBranchHeaders, drawCompactBranchNames } from './drawBranchHeaders';
import { drawDateRuler, drawDaySeparators } from './drawDateRuler';
import { drawLabels } from './drawLabels';
import { drawLanes } from './drawLanes';
import { drawMergeLinks } from './drawMergeLinks';
import { drawNodes } from './drawNodes';
import { toWorld } from './viewport';

/**
 * Draws one frame, back to front: day separators, branch bands, links, changesets, labels and
 * branch headers, then the date ruler on top. Only what is on screen is drawn, so large histories stay smooth.
 * Returns where the code review chips landed.
 */
export function drawGraph(ctx: CanvasRenderingContext2D, scene: GraphScene, pixelRatio: number): DrawnReviewChip[] {
  const { viewport, size, palette } = scene;
  const draw: DrawContext = { ctx, scene, visible: visibleArea(scene), detail: detailLevel(viewport.zoom, scene.options), reviewChips: [] };

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, size.width, size.height);
  drawDaySeparators(draw);

  ctx.setTransform(pixelRatio * viewport.zoom, 0, 0, pixelRatio * viewport.zoom, pixelRatio * viewport.panX, pixelRatio * viewport.panY);
  drawLanes(draw);
  drawMergeLinks(draw);
  drawNodes(draw);
  if (draw.detail.text) {
    drawLabels(draw);
    drawBranchHeaders(draw);
  }

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  if (!draw.detail.text) drawCompactBranchNames(draw);
  drawDateRuler(draw);
  return draw.reviewChips;
}

function visibleArea({ viewport, size }: GraphScene): VisibleArea {
  const topLeft = toWorld(viewport, 0, 0);
  const bottomRight = toWorld(viewport, size.width, size.height);
  return {
    left: topLeft.x,
    top: topLeft.y,
    right: bottomRight.x,
    bottom: bottomRight.y,
    firstColumn: Math.max(0, Math.floor((topLeft.x - GRAPH_PADDING.left) / COLUMN_WIDTH) - 1),
    lastColumn: Math.ceil((bottomRight.x - GRAPH_PADDING.left) / COLUMN_WIDTH) + 1,
  };
}
