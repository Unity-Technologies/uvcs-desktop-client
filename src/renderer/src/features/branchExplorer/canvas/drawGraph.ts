import { COLUMN_WIDTH, GRAPH_PADDING } from './geometry';
import { detailLevel, type DrawContext, type DrawnTargets, type GraphScene, type VisibleArea } from './drawContext';
import { drawBranchHeaders, drawCompactBranchNames } from './drawBranchHeaders';
import { drawCaptions } from './drawCaptions';
import { drawDateRuler, drawDaySeparators, measureDayMarks } from './drawDateRuler';
import { drawLabels } from './drawLabels';
import { drawLanes } from './drawLanes';
import { drawMergeLinks } from './drawMergeLinks';
import { drawNodes } from './drawNodes';
import { toWorld } from './viewport';

/**
 * Draws one frame, back to front: day separators, branch bands, links, changesets, their comments, labels and
 * branch headers, then the date ruler on top. Only what is on screen is drawn, so large histories stay smooth.
 * Fills `drawn` with where the pointer targets landed.
 */
export function drawGraph(ctx: CanvasRenderingContext2D, scene: GraphScene, pixelRatio: number, drawn: DrawnTargets): void {
  const { viewport, size, palette } = scene;
  drawn.reviewChips.reset();
  drawn.branchHeaders.reset();
  drawn.captions.reset();
  const draw: DrawContext = { ctx, scene, visible: visibleArea(scene), detail: detailLevel(viewport.zoom, scene.options), pixelRatio, drawn };
  const screen = (): void => ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const world = (): void =>
    ctx.setTransform(pixelRatio * viewport.zoom, 0, 0, pixelRatio * viewport.zoom, pixelRatio * viewport.panX, pixelRatio * viewport.panY);

  measureDayMarks(draw);
  screen();
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, size.width, size.height);
  drawDaySeparators(draw);

  world();
  drawLanes(draw);
  drawMergeLinks(draw);
  drawNodes(draw);
  screen();
  drawCaptions(draw);

  if (draw.detail.text) {
    world();
    drawLabels(draw);
    drawBranchHeaders(draw);
    screen();
  } else {
    drawCompactBranchNames(draw);
  }
  drawDateRuler(draw);
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
