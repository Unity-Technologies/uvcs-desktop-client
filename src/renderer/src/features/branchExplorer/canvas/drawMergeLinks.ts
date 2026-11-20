import type { MergeLink, MergeLinkType } from '@shared/domain/branchExplorer';
import { arrowLength, drawArrowHead, lineUnderHead } from './drawArrowHead';
import { STRUCTURE_DIMMED_ALPHA, type DrawContext } from './drawContext';
import { arrivalAt, curveUntil } from './curves';
import {
  GAP_LAYERS,
  GAP_REACH,
  gapLayerAlpha,
  GLOW_LAYERS,
  GLOW_REACH,
  glowingPathsByColor,
  glowLayerAlpha,
  inDrawingOrder,
  layerWidths,
  type StyledLink,
} from './mergeLinkGlow';
import { mergeLinkPath, pathPoints, type LinkPath } from './mergeLinkPath';
import { NODE_RADIUS, nodePoint, pendingPoint } from './geometry';
import { mergeLinkDash, PENDING_LINK_DASH } from './graphPalette';
import { boundsOf, crossesView } from './linkVisibility';
import { mergeLinksAcross } from './spansInView';

const ARROW_SIZE = arrowLength(2.5);
const DOT_RADIUS = 5;
const MARGIN = NODE_RADIUS + ARROW_SIZE + GLOW_REACH;
const LINE_WIDTH = 2;
const EMPHASIZED_LINE_WIDTH = 2.5;

interface ShownLink extends StyledLink<LinkPath> {
  dash: number[];
  cap: CanvasLineCap;
}

export function drawMergeLinks(draw: DrawContext): void {
  const { scene, visible } = draw;
  const { search, selectedChangeset, hoveredChangeset, hoveredMergeLink } = scene;
  const shown: ShownLink[] = [];
  for (const link of mergeLinksAcross(scene.layout, visible.left - MARGIN, visible.right + MARGIN)) {
    const path = mergeLinkPath(nodePoint(scene.layout, link.sourceChangeset)!, nodePoint(scene.layout, link.destinationChangeset)!);
    if (!crossesView(boundsOf(pathPoints(path)), visible, MARGIN)) continue;
    shown.push({
      path,
      color: linkColor(draw, link),
      dash: mergeLinkDash(link.type),
      cap: 'butt',
      // While searching, a link stays lit only between two hits; the rest recede with the changesets they join.
      lit: !search || (search.changesets.has(link.sourceChangeset) && search.changesets.has(link.destinationChangeset)),
      emphasized: link === hoveredMergeLink || involves(link, selectedChangeset) || involves(link, hoveredChangeset),
    });
  }
  drawLinks(draw, shown);
}

/**
 * The merges in progress, into the pending changeset: styled as the links they will be once checked in, but dotted.
 * They recede while searching, as the pending changeset is never a hit.
 */
export function drawPendingMergeLinks(draw: DrawContext): void {
  const { scene, visible } = draw;
  const to = pendingPoint(scene.layout);
  if (!to) return;
  const shown: ShownLink[] = [];
  for (const link of scene.layout.pending!.mergeLinks) {
    const path = mergeLinkPath(nodePoint(scene.layout, link.sourceChangeset)!, to);
    if (!crossesView(boundsOf(pathPoints(path)), visible, MARGIN)) continue;
    shown.push({
      path,
      color: linkColor(draw, link),
      dash: PENDING_LINK_DASH,
      // Zero-length dashes with round caps: dots.
      cap: 'round',
      lit: !scene.search,
      emphasized:
        link === scene.hoveredMergeLink || scene.hoveredPending || scene.hoveredChangeset === link.sourceChangeset || scene.selectedChangeset === link.sourceChangeset,
    });
  }
  drawLinks(draw, shown);
}

/**
 * The glow, then the gap, each as one shape under every line, then the lines in their drawing order (`inDrawingOrder`):
 * a link's gap never cuts through another link's line, and the emphasized links lie on top.
 */
function drawLinks(draw: DrawContext, shown: readonly ShownLink[]): void {
  if (shown.length === 0) return;
  drawGlows(draw, shown);
  drawGaps(draw, shown);
  for (const link of inDrawingOrder(shown)) drawLink(draw, link);
}

/** The faint glow under the lit links (`mergeLinkGlow`): each color's links as one shape, stroked layer by layer. */
function drawGlows(draw: DrawContext, shown: readonly ShownLink[]): void {
  const { ctx, scene } = draw;
  const layerAlpha = glowLayerAlpha(draw.zoom, scene.palette.isDark);
  if (layerAlpha === 0) return;
  ctx.save();
  // On a dark graph the glow lightens what is under it, as light does on a dark surface.
  if (scene.palette.isDark) ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = layerAlpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [color, paths] of glowingPathsByColor(shown)) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (const path of paths) tracePath(draw, path);
    strokeLayers(ctx, layerWidths(LINE_WIDTH, GLOW_REACH, GLOW_LAYERS));
  }
  ctx.restore();
}

/** The background under every lit link, solid at the line and fading out: the links lie over what they cross. */
function drawGaps(draw: DrawContext, shown: readonly ShownLink[]): void {
  const { ctx, scene } = draw;
  const layerAlpha = gapLayerAlpha(draw.zoom);
  const lit = shown.filter((link) => link.lit);
  if (layerAlpha === 0 || lit.length === 0) return;
  ctx.save();
  ctx.strokeStyle = scene.palette.background;
  ctx.globalAlpha = layerAlpha;
  ctx.beginPath();
  for (const { path } of lit) tracePath(draw, path);
  strokeLayers(ctx, layerWidths(LINE_WIDTH, GAP_REACH, GAP_LAYERS));
  ctx.restore();
}

/** Every kind of link has its own color, whatever branches it joins: a merge never reads as a branch's line. */
function linkColor({ scene }: DrawContext, link: { type: MergeLinkType }): string {
  return scene.palette.mergeLinks[link.type];
}

function drawLink(draw: DrawContext, { path, color, dash, cap, emphasized, lit }: ShownLink): void {
  const { ctx, pen } = draw;
  const last = path[path.length - 1]!;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = emphasized ? 1 : lit ? 0.75 : STRUCTURE_DIMMED_ALPHA;
  const lineWidth = emphasized ? EMPHASIZED_LINE_WIDTH : LINE_WIDTH;
  const length = arrowLength(lineWidth);
  const tipDistance = draw.detail.avatars ? NODE_RADIUS + 4 : DOT_RADIUS + 3;
  // Tip and base both on the path's last curve: the head follows its arrival and the line meets the middle of its base.
  const tip = arrivalAt(last, tipDistance);
  const base = arrivalAt(last, tipDistance + length);
  const [start, c1, c2, end] = curveUntil(last, arrivalAt(last, tipDistance + length - lineUnderHead(draw)).t);
  ctx.beginPath();
  tracePath(draw, path.slice(0, -1));
  if (path.length === 1) pen.moveTo(start.x, start.y);
  pen.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
  if (emphasized && lit) drawEmphasisGlow(draw, lineWidth);
  ctx.lineWidth = lineWidth;
  ctx.lineCap = cap;
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash(NO_DASH);
  drawArrowHead(draw, tip, base);
  ctx.restore();
}

/** Adds the path's curves to the context's path, as a new subpath. */
function tracePath({ pen }: DrawContext, path: LinkPath): void {
  if (path.length === 0) return;
  pen.moveTo(path[0]![0].x, path[0]![0].y);
  for (const [, c1, c2, end] of path) pen.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
}

/** The emphasized link glows a little more, over the shared glow, on the path being drawn. */
function drawEmphasisGlow(draw: DrawContext, lineWidth: number): void {
  const { ctx, scene } = draw;
  const layerAlpha = glowLayerAlpha(draw.zoom, scene.palette.isDark);
  if (layerAlpha === 0) return;
  ctx.save();
  if (scene.palette.isDark) ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = layerAlpha;
  ctx.lineCap = 'round';
  strokeLayers(ctx, layerWidths(lineWidth, GLOW_REACH, GLOW_LAYERS));
  ctx.restore();
}

function strokeLayers(ctx: CanvasRenderingContext2D, widths: readonly number[]): void {
  for (const width of widths) {
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

const NO_DASH: number[] = [];

function involves(link: MergeLink, changeset: number | null): boolean {
  return changeset === link.sourceChangeset || changeset === link.destinationChangeset;
}
