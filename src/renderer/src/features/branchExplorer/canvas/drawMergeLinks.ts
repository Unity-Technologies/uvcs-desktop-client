import type { MergeLink, MergeLinkType } from '@shared/domain/branchExplorer';
import { arrowLength, drawArrowHead, lineUnderHead } from './drawArrowHead';
import { STRUCTURE_DIMMED_ALPHA, type DrawContext } from './drawContext';
import { arrivalAt, curveUntil } from './curves';
import { GAP_LAYER_ALPHA, GAP_LAYERS, GAP_REACH, GLOW_LAYERS, GLOW_REACH, glowLayerAlpha, layerWidths } from './mergeLinkGlow';
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

interface ShownLink {
  link: MergeLink;
  path: LinkPath;
  lit: boolean;
}

export function drawMergeLinks(draw: DrawContext): void {
  const { scene, visible } = draw;
  const { search, selectedChangeset, hoveredChangeset } = scene;
  const shown: ShownLink[] = [];
  for (const link of mergeLinksAcross(scene.layout, visible.left - MARGIN, visible.right + MARGIN)) {
    const path = mergeLinkPath(nodePoint(scene.layout, link.sourceChangeset)!, nodePoint(scene.layout, link.destinationChangeset)!);
    if (!crossesView(boundsOf(pathPoints(path)), visible, MARGIN)) continue;
    // While searching, a link stays lit only between two hits; the rest recede with the changesets they join.
    const lit = !search || (search.changesets.has(link.sourceChangeset) && search.changesets.has(link.destinationChangeset));
    shown.push({ link, path, lit });
  }
  drawGlows(draw, shown);
  for (const { link, path, lit } of shown) {
    drawLink(draw, path, {
      color: linkColor(draw, link),
      dash: mergeLinkDash(link.type),
      cap: 'butt',
      emphasized: involves(link, selectedChangeset) || involves(link, hoveredChangeset),
      lit,
    });
  }
}

/**
 * The merges in progress, into the pending changeset: styled as the links they will be once checked in, but dotted.
 * They recede while searching, as the pending changeset is never a hit.
 */
export function drawPendingMergeLinks(draw: DrawContext): void {
  const { scene, visible } = draw;
  const to = pendingPoint(scene.layout);
  if (!to) return;
  for (const link of scene.layout.pending!.mergeLinks) {
    const path = mergeLinkPath(nodePoint(scene.layout, link.sourceChangeset)!, to);
    if (!crossesView(boundsOf(pathPoints(path)), visible, MARGIN)) continue;
    drawLink(draw, path, {
      color: linkColor(draw, link),
      dash: PENDING_LINK_DASH,
      // Zero-length dashes with round caps: dots.
      cap: 'round',
      emphasized:
        scene.hoveredPending || scene.hoveredChangeset === link.sourceChangeset || scene.selectedChangeset === link.sourceChangeset,
      lit: !scene.search,
    });
  }
}

/**
 * The faint glow under the lit links (`mergeLinkGlow`). The links of one color are stroked as one shape, layer by
 * layer, so merges sharing a route glow once instead of piling up into a solid bar.
 */
function drawGlows(draw: DrawContext, shown: readonly ShownLink[]): void {
  const { ctx, scene } = draw;
  const layerAlpha = glowLayerAlpha(draw.zoom, scene.palette.isDark);
  if (layerAlpha === 0) return;
  const pathsByColor = new Map<string, LinkPath[]>();
  for (const { link, path, lit } of shown) {
    if (!lit) continue;
    const color = linkColor(draw, link);
    const paths = pathsByColor.get(color);
    if (paths) paths.push(path);
    else pathsByColor.set(color, [path]);
  }
  ctx.save();
  // On a dark graph the glow lightens what is under it, as light does on a dark surface.
  if (scene.palette.isDark) ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = layerAlpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [color, paths] of pathsByColor) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (const path of paths) tracePath(draw, path);
    strokeLayers(ctx, layerWidths(LINE_WIDTH, GLOW_REACH, GLOW_LAYERS));
  }
  ctx.restore();
}

/** Every kind of link has its own color, whatever branches it joins: a merge never reads as a branch's line. */
function linkColor({ scene }: DrawContext, link: { type: MergeLinkType }): string {
  return scene.palette.mergeLinks[link.type];
}

interface LinkStyle {
  color: string;
  dash: number[];
  cap: CanvasLineCap;
  emphasized: boolean;
  lit: boolean;
}

function drawLink(draw: DrawContext, path: LinkPath, { color, dash, cap, emphasized, lit }: LinkStyle): void {
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
  drawGap(draw, lineWidth);
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

/** The background under the path being drawn, solid at the line and fading out: the link lies over what it crosses. */
function drawGap({ ctx, scene }: DrawContext, lineWidth: number): void {
  ctx.save();
  ctx.strokeStyle = scene.palette.background;
  ctx.globalAlpha = GAP_LAYER_ALPHA;
  strokeLayers(ctx, layerWidths(lineWidth, GAP_REACH, GAP_LAYERS));
  ctx.restore();
}

/** The hovered or selected link glows a little more, over the shared glow. */
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
