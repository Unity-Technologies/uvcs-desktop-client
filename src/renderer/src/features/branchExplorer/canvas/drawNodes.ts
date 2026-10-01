import type { NodeLayout } from '../model/layoutGraph';
import { arrowLength, drawArrowHead, lineUnderHead } from './drawArrowHead';
import { drawAvatar, drawDot } from './drawAvatar';
import { drawCollapsedNode } from './drawCollapsedNode';
import { DIMMED_ALPHA, isChangesetDimmed, STRUCTURE_DIMMED_ALPHA, type DrawContext } from './drawContext';
import { drawHomeMarker } from './drawHomeMarker';
import { drawSelectionHalo, drawSelectionRing } from './drawNodeSelection';
import { drawPendingChangeset } from './drawPendingChangeset';
import { drawNodeCorona, drawNodeGlow } from './drawSearchHit';
import { BAND_HEIGHT, COLLAPSED_NODE_HALF_WIDTH, columnX, NODE_RADIUS, nodePoint, pendingPoint, rowY } from './geometry';
import { branchColor } from './graphPalette';
import { boundsOf, crossesView } from './linkVisibility';
import { hasParentOffGraph, parentLinksInView } from './parentLinks';

const DOT_RADIUS = 5;
/** A parent line's arrowhead, pointing back at the parent: the same head as the merge links'. */
const PARENT_ARROW = arrowLength(2);
/** How far the dashed line of a changeset whose parent is off the graph reaches past the changeset. */
const OFF_GRAPH_STUB_LENGTH = 22;
/** The branch-colored ring around a changeset's avatar: 2 px, a little more while hovered, as the links are. */
const RING_WIDTH = 2;
const HOVERED_RING_WIDTH = 2.5;

/** The changesets on screen, refilled every frame instead of allocated. */
const visible: NodeLayout[] = [];

/** Changesets with the links to their parents, and the pending changeset. */
export function drawNodes(draw: DrawContext): void {
  const nodes = visibleNodes(draw);
  parentLinksInView(draw.scene.layout, draw.visible, NODE_RADIUS).forEach(({ parent, child }) => drawParentLink(draw, parent, child));
  for (const node of nodes) {
    if (hasParentOffGraph(draw.scene.layout, node)) drawOffGraphStub(draw, node);
  }
  for (const node of nodes) drawNode(draw, node);

  const { layout } = draw.scene;
  const pending = pendingPoint(layout);
  if (pending && crossesView(boundsOf([nodePoint(layout, layout.pending!.parent) ?? pending, pending]), draw.visible, BAND_HEIGHT * 2)) {
    drawPendingChangeset(draw, layout.pending!);
  }
}

/**
 * The workspace marker: on the pending changeset when there is one (what the workspace has is the loaded changeset
 * and its changes), else on the loaded changeset. Drawn over the branch headers, as its shoulder can reach the header
 * card sitting on the band's edge.
 */
export function drawWorkspaceMarker(draw: DrawContext): void {
  const { homeChangeset, layout } = draw.scene;
  const home = pendingPoint(layout) ?? (homeChangeset !== null ? nodePoint(layout, homeChangeset) : null);
  if (home && crossesView(boundsOf([home]), draw.visible, BAND_HEIGHT)) drawHomeMarker(draw, home, radiusFor(draw));
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
  const ringWidth = hovered ? HOVERED_RING_WIDTH : RING_WIDTH;
  const isHit = search?.changesets.has(id) ?? false;
  const isCurrentHit = isHit && search?.active?.kind === 'changeset' && search.active.id === id;

  ctx.save();
  // An opaque disc first: lines end behind the changeset, so a faded one never shows them through its face. It stops
  // just inside the branch ring's outer edge, so no light outline shows around the ring: the ring alone sets the
  // changeset off the band and the lines.
  ctx.fillStyle = palette.background;
  if (hovered && !search) {
    // Hovering lifts the changeset off the band.
    ctx.shadowColor = palette.isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(31, 35, 40, 0.3)';
    ctx.shadowBlur = 6 * draw.pixelRatio * scene.viewport.zoom;
    ctx.shadowOffsetY = 1.5 * draw.pixelRatio * scene.viewport.zoom;
  }
  ctx.beginPath();
  pen.arc(x, y, radius + (detail.avatars ? ringWidth - 0.5 : 2), 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  if (isHit) drawNodeGlow(draw, x, y, radius, isCurrentHit);
  if (selected) drawSelectionHalo(draw, x, y, radius);

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
