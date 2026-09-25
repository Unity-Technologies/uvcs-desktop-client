import type { NodeLayout } from '../model/layoutGraph';
import { drawAvatar, drawDot } from './drawAvatar';
import { drawCollapsedNode } from './drawCollapsedNode';
import { DIMMED_ALPHA, isChangesetDimmed, type DrawContext } from './drawContext';
import { drawHomeMarker } from './drawHomeMarker';
import { drawNodeHit } from './drawSearchHit';
import { fitText, summaryOf } from './fitText';
import { BAND_HEIGHT, COLLAPSED_NODE_HALF_WIDTH, COLUMN_WIDTH, columnX, NODE_RADIUS, rowY } from './geometry';
import { branchColor } from './graphPalette';
import { nextColumnOnRow } from './rowNeighbors';

const DOT_RADIUS = 5;
const ARROW_SIZE = 4;
/** Comments start a little left of their changeset and may use the free space up to the next one on the row. */
const COMMENT_INSET = COLUMN_WIDTH / 2 - 6;
const LAST_COMMENT_WIDTH = 220;

/** Changesets with the links to their parents, their comments and the workspace marker. */
export function drawNodes(draw: DrawContext): void {
  const nodes = visibleNodes(draw);
  nodes.forEach((node) => drawParentLink(draw, node));
  nodes.forEach((node) => drawNode(draw, node));
  if (draw.detail.comments) nodes.forEach((node) => drawComment(draw, node));

  const home = draw.scene.homeChangeset !== null ? draw.scene.layout.nodes.get(draw.scene.homeChangeset) : undefined;
  if (home && nodes.includes(home)) drawHomeMarker(draw, home, radiusFor(draw));
}

function visibleNodes({ scene, visible }: DrawContext): NodeLayout[] {
  const { nodesByColumn } = scene.layout;
  const lastColumn = Math.min(visible.lastColumn, nodesByColumn.length - 1);
  const nodes: NodeLayout[] = [];
  for (let column = visible.firstColumn; column <= lastColumn; column++) {
    const node = nodesByColumn[column]!;
    const y = rowY(node.row);
    if (y >= visible.top - BAND_HEIGHT && y <= visible.bottom + BAND_HEIGHT * 2) nodes.push(node);
  }
  return nodes;
}

function radiusFor({ detail }: DrawContext): number {
  return detail.avatars ? NODE_RADIUS : DOT_RADIUS;
}

/** The line along the band to the previous changeset of the same branch, with an arrow pointing to it. */
function drawParentLink(draw: DrawContext, node: NodeLayout): void {
  const { ctx, scene, detail } = draw;
  const parent = scene.layout.nodes.get(node.changeset.parent);
  if (!parent || parent.changeset.branch !== node.changeset.branch) return;

  const radius = radiusFor(draw);
  const y = rowY(node.row);
  const fromX = columnX(parent.column) + (parent.collapsed && detail.text ? COLLAPSED_NODE_HALF_WIDTH - 4 : radius) + 2;
  const toX = columnX(node.column) - radius - 2;
  if (toX <= fromX) return;

  ctx.save();
  ctx.strokeStyle = branchColor(scene.palette, node.changeset.branch);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.globalAlpha = isChangesetDimmed(scene, node.changeset) ? DIMMED_ALPHA : 0.6;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fromX + (detail.text ? ARROW_SIZE : 0), y);
  ctx.lineTo(toX, y);
  ctx.stroke();
  if (detail.text) {
    ctx.beginPath();
    ctx.moveTo(fromX, y);
    ctx.lineTo(fromX + ARROW_SIZE * 1.6, y - ARROW_SIZE);
    ctx.lineTo(fromX + ARROW_SIZE * 1.6, y + ARROW_SIZE);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawNode(draw: DrawContext, node: NodeLayout): void {
  const { ctx, scene, detail } = draw;
  const { palette } = scene;
  const x = columnX(node.column);
  const y = rowY(node.row);
  const id = node.changeset.id;
  const hovered = scene.hoveredChangeset === id;
  if (node.collapsed) return drawCollapsedNode(draw, node, hovered);
  const selected = scene.selectedChangeset === id;
  const radius = radiusFor(draw) + (hovered ? 1 : 0);
  const color = branchColor(palette, node.changeset.branch);

  ctx.save();
  ctx.globalAlpha = isChangesetDimmed(scene, node.changeset) ? DIMMED_ALPHA : 1;
  if (scene.search?.changesets.has(id)) {
    const current = scene.search.active?.kind === 'changeset' && scene.search.active.id === id;
    drawNodeHit(ctx, x, y, radius, palette.searchHit, current, scene.searchPing);
  }
  if (selected) drawHalo(ctx, x, y, radius + 8, palette.accent, 0.22);

  if (detail.avatars) {
    drawAvatar(ctx, {
      x,
      y,
      radius,
      owner: node.changeset.owner,
      ringColor: selected ? palette.accent : color,
      ringWidth: hovered || selected ? 3 : 2.25,
      outlineColor: palette.background,
      showInitials: detail.text,
      font: `600 9.5px ${palette.fontUi}`,
    });
  } else {
    drawDot(ctx, x, y, radius, selected ? palette.accent : color, palette.background);
  }
  ctx.restore();
}

function drawHalo(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha: number): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The comment's first line under the changeset, shortened to the room before the next changeset on the row. */
function drawComment({ ctx, scene }: DrawContext, node: NodeLayout): void {
  const summary = !node.collapsed && summaryOf(node.changeset.comment);
  if (!summary) return;

  const left = columnX(node.column) - COMMENT_INSET;
  const next = nextColumnOnRow(scene.layout, node.column);
  const maxWidth = next === -1 ? LAST_COMMENT_WIDTH : columnX(next) - COMMENT_INSET - left - 8;

  ctx.save();
  ctx.globalAlpha = isChangesetDimmed(scene, node.changeset) ? DIMMED_ALPHA : 1;
  ctx.font = `400 10.5px ${scene.palette.fontUi}`;
  ctx.fillStyle = scene.selectedChangeset === node.changeset.id ? scene.palette.textPrimary : scene.palette.textSecondary;
  ctx.textBaseline = 'middle';
  const text = fitText(ctx, summary, maxWidth);
  const y = rowY(node.row) + BAND_HEIGHT / 2 + 12;
  // A halo in the background color keeps the text readable where links cross it.
  ctx.strokeStyle = scene.palette.background;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.strokeText(text, left, y);
  ctx.fillText(text, left, y);
  ctx.restore();
}
