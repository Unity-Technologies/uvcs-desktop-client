import type { NodeLayout } from '../model/layoutGraph';
import { arrowLength, drawArrowHead, lineUnderHead } from './drawArrowHead';
import { drawAvatar, drawDot } from './drawAvatar';
import { drawCollapsedNode } from './drawCollapsedNode';
import { DIMMED_ALPHA, isChangesetDimmed, STRUCTURE_DIMMED_ALPHA, type DrawContext } from './drawContext';
import { drawHomeMarker } from './drawHomeMarker';
import { drawNodeCorona, drawNodeGlow } from './drawSearchHit';
import { BAND_HEIGHT, COLLAPSED_NODE_HALF_WIDTH, columnX, NODE_RADIUS, rowY } from './geometry';
import { branchColor } from './graphPalette';
import { hasParentOffGraph, parentLinksInView } from './parentLinks';

const DOT_RADIUS = 5;
/** A parent line's arrowhead, pointing back at the parent: the same head as the merge links'. */
const PARENT_ARROW = arrowLength(2);
/** How far the dashed line of a changeset whose parent is off the graph reaches past the changeset. */
const OFF_GRAPH_STUB_LENGTH = 22;
/** The selection: a soft halo behind the changeset and an accent ring just outside its branch ring. */
const SELECTION_HALO = 8;
const SELECTION_RING = 4;

/** The changesets on screen, refilled every frame instead of allocated. */
const visible: NodeLayout[] = [];

/** Changesets with the links to their parents and the workspace marker. */
export function drawNodes(draw: DrawContext): void {
  const nodes = visibleNodes(draw);
  parentLinksInView(draw.scene.layout, draw.visible, NODE_RADIUS).forEach(({ parent, child }) => drawParentLink(draw, parent, child));
  for (const node of nodes) {
    if (hasParentOffGraph(draw.scene.layout, node)) drawOffGraphStub(draw, node);
  }
  for (const node of nodes) drawNode(draw, node);

  const { homeChangeset, layout } = draw.scene;
  const home = homeChangeset !== null ? layout.nodes.get(homeChangeset) : undefined;
  if (home && nodes.includes(home)) drawHomeMarker(draw, home, radiusFor(draw));
}

function visibleNodes({ scene, visible: area }: DrawContext): NodeLayout[] {
  const { nodesByColumn } = scene.layout;
  const lastColumn = Math.min(area.lastColumn, nodesByColumn.length - 1);
  visible.length = 0;
  for (let column = area.firstColumn; column <= lastColumn; column++) {
    const node = nodesByColumn[column]!;
    const y = rowY(node.row);
    if (y >= area.top - BAND_HEIGHT && y <= area.bottom + BAND_HEIGHT * 2) visible.push(node);
  }
  return visible;
}

function radiusFor({ detail }: DrawContext): number {
  return detail.avatars ? NODE_RADIUS : DOT_RADIUS;
}

/** The line along the band to the previous changeset of the same branch, with an arrow pointing to it. */
function drawParentLink(draw: DrawContext, parent: NodeLayout, node: NodeLayout): void {
  const { ctx, pen, scene, detail } = draw;
  const radius = radiusFor(draw);
  const y = rowY(node.row);
  const fromX = columnX(parent.column) + (parent.collapsed && detail.text ? COLLAPSED_NODE_HALF_WIDTH - 4 : radius) + 2;
  const toX = columnX(node.column) - radius - 2;
  if (toX <= fromX) return;

  const { search } = scene;
  ctx.save();
  ctx.strokeStyle = branchColor(scene.palette, node.changeset.branch);
  ctx.fillStyle = ctx.strokeStyle;
  // While searching, a line stays lit only between two hits.
  if (search) ctx.globalAlpha = search.changesets.has(node.changeset.id) && search.changesets.has(parent.changeset.id) ? 0.7 : STRUCTURE_DIMMED_ALPHA;
  else ctx.globalAlpha = isChangesetDimmed(scene, node.changeset) ? DIMMED_ALPHA : 0.7;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const baseX = fromX + PARENT_ARROW;
  pen.moveTo(detail.text ? baseX - lineUnderHead(draw) : fromX, y);
  pen.lineTo(toX, y);
  ctx.stroke();
  if (detail.text) drawArrowHead(draw, { x: fromX, y }, { x: baseX, y });
  ctx.restore();
}

const STUB_DASH = [3, 3];

/** A short dashed line leading left from a changeset whose parent is not in the graph (as gitgrove does). */
function drawOffGraphStub(draw: DrawContext, node: NodeLayout): void {
  const { ctx, pen, scene } = draw;
  const x = columnX(node.column) - radiusFor(draw) - 2;
  const y = rowY(node.row);

  ctx.save();
  ctx.strokeStyle = branchColor(scene.palette, node.changeset.branch);
  ctx.globalAlpha = isChangesetDimmed(scene, node.changeset) ? DIMMED_ALPHA : 0.6;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'butt';
  ctx.setLineDash(STUB_DASH);
  ctx.beginPath();
  pen.moveTo(x - OFF_GRAPH_STUB_LENGTH, y);
  pen.lineTo(x, y);
  ctx.stroke();
  ctx.restore();
}

function drawNode(draw: DrawContext, node: NodeLayout): void {
  const { ctx, pen, scene, detail } = draw;
  const { palette, search } = scene;
  const x = columnX(node.column);
  const y = rowY(node.row);
  const id = node.changeset.id;
  const hovered = scene.hoveredChangeset === id;
  if (node.collapsed) return drawCollapsedNode(draw, node, hovered);
  const selected = scene.selectedChangeset === id;
  const radius = radiusFor(draw);
  const ringWidth = hovered ? 3 : 2.25;
  const isHit = search?.changesets.has(id) ?? false;
  const isCurrentHit = isHit && search?.active?.kind === 'changeset' && search.active.id === id;

  ctx.save();
  // An opaque disc first: lines end behind the changeset, so a faded one never shows them through its face.
  ctx.fillStyle = palette.background;
  if (hovered && !search) {
    // Hovering lifts the changeset off the band.
    ctx.shadowColor = palette.isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(31, 35, 40, 0.3)';
    ctx.shadowBlur = 6 * draw.pixelRatio * scene.viewport.zoom;
    ctx.shadowOffsetY = 1.5 * draw.pixelRatio * scene.viewport.zoom;
  }
  ctx.beginPath();
  pen.arc(x, y, radius + (detail.avatars ? ringWidth + 1.5 : 2), 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  if (isHit) drawNodeGlow(draw, x, y, radius, isCurrentHit);
  if (selected) {
    ctx.fillStyle = palette.accentSoft;
    ctx.beginPath();
    pen.arc(x, y, radius + SELECTION_HALO, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = isChangesetDimmed(scene, node.changeset) ? DIMMED_ALPHA : 1;
  const color = branchColor(palette, node.changeset.branch);
  if (detail.avatars) {
    drawAvatar(draw, {
      x,
      y,
      radius,
      owner: node.changeset.owner,
      ringColor: color,
      ringWidth,
      outlineColor: palette.background,
      showInitials: detail.text,
      font: palette.fonts.initials,
    });
  } else {
    drawDot(draw, x, y, radius + (hovered ? 1 : 0), color, palette.background);
  }
  ctx.restore();

  if (isCurrentHit) drawNodeCorona(draw, x, y, detail.avatars ? radius + ringWidth / 2 : radius);
  else if (selected) drawSelectionRing(draw, x, y, radius);
}

function drawSelectionRing({ ctx, pen, scene, detail }: DrawContext, x: number, y: number, radius: number): void {
  ctx.save();
  ctx.strokeStyle = scene.palette.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  pen.arc(x, y, radius + (detail.avatars ? SELECTION_RING + 1 : SELECTION_RING - 1), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
