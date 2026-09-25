import { COLUMN_WIDTH, GRAPH_PADDING } from './geometry';
import { TEXT_ZOOM_THRESHOLD, type DrawContext, type GraphScene, type VisibleArea } from './drawContext';
import { drawDateHeader } from './drawDateHeader';
import { drawLanes } from './drawLanes';
import { drawMergeLinks } from './drawMergeLinks';
import { drawNodes } from './drawNodes';
import { toWorld } from './viewport';

/** Draws one frame. Only what is on screen is drawn, so large histories stay smooth. */
export function drawGraph(ctx: CanvasRenderingContext2D, scene: GraphScene, pixelRatio: number): void {
  const { viewport, size, palette } = scene;

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, size.width, size.height);

  ctx.setTransform(
    pixelRatio * viewport.zoom,
    0,
    0,
    pixelRatio * viewport.zoom,
    pixelRatio * viewport.panX,
    pixelRatio * viewport.panY,
  );

  const draw: DrawContext = { ctx, scene, visible: visibleArea(scene), showText: viewport.zoom >= TEXT_ZOOM_THRESHOLD };
  drawLanes(draw);
  drawMergeLinks(draw);
  drawNodes(draw);

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  drawDateHeader(draw);
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
