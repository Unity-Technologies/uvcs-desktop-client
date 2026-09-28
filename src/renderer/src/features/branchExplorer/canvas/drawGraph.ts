import { COLUMN_WIDTH, GRAPH_PADDING } from './geometry';
import { detailLevel, type DrawContext, type DrawnTargets, type GraphScene, type VisibleArea } from './drawContext';
import { drawBranchHeaders, drawCompactBranchNames } from './drawBranchHeaders';
import { drawCaptions } from './drawCaptions';
import { drawDateRuler, drawDaySeparators, measureDayMarks } from './drawDateRuler';
import { drawLabels } from './drawLabels';
import { drawLanes } from './drawLanes';
import { drawMergeLinks, drawPendingMergeLinks } from './drawMergeLinks';
import { drawNodes } from './drawNodes';
import { OriginPen, originFor } from './pen';
import { toWorld } from './viewport';

/** The world pen, aimed anew at every frame instead of allocated. */
const worldPen = new OriginPen();

/**
 * Draws one frame, back to front: day separators, branch bands, links, changesets, their comments, labels and
 * branch headers, then the date ruler on top. Only what is on screen is drawn, so large histories stay smooth.
 * The world is drawn relative to an origin near the screen (`OriginPen`), so the canvas only ever sees small numbers.
 * Fills `drawn` with where the pointer targets landed.
 */
export function drawGraph(ctx: CanvasRenderingContext2D, scene: GraphScene, pixelRatio: number, drawn: DrawnTargets): void {
  const { viewport, size, palette } = scene;
  drawn.reviewChips.reset();
  drawn.branchHeaders.reset();
  drawn.cutBranchComments.reset();
  drawn.captions.reset();
  const visible = visibleArea(scene);
  const draw: DrawContext = { ctx, pen: ctx, scene, visible, detail: detailLevel(viewport.zoom, scene.options), pixelRatio, drawn };
  const originX = originFor(visible.left);
  const originY = originFor(visible.top);
  worldPen.aim(ctx, originX, originY);
  const screen = (): void => {
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    draw.pen = ctx;
  };
  const world = (): void => {
    const { zoom, panX, panY } = viewport;
    ctx.setTransform(pixelRatio * zoom, 0, 0, pixelRatio * zoom, pixelRatio * (panX + originX * zoom), pixelRatio * (panY + originY * zoom));
    draw.pen = worldPen;
  };

  measureDayMarks(draw);
  screen();
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, size.width, size.height);
  drawDaySeparators(draw);

  world();
  drawLanes(draw);
  drawMergeLinks(draw);
  drawPendingMergeLinks(draw);
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
