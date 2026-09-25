import type { GraphLabel } from '@shared/domain/branchExplorer';
import type { NodeLayout } from '../model/layoutGraph';
import type { DrawContext } from './drawContext';
import { columnX, NODE_RADIUS, rowY } from './geometry';
import { branchColor } from './graphPalette';
import { LABEL_HEIGHT, labelTop } from './graphTargets';

export function drawNodes(draw: DrawContext): void {
  const { scene, visible } = draw;
  const { nodesByColumn } = scene.layout;
  const lastColumn = Math.min(visible.lastColumn, nodesByColumn.length - 1);

  for (let column = visible.firstColumn; column <= lastColumn; column++) {
    const node = nodesByColumn[column]!;
    const y = rowY(node.row);
    if (y < visible.top - 60 || y > visible.bottom + 20) continue;

    drawNode(draw, node);
    const labels = scene.layout.labelsByChangeset.get(node.changeset.id);
    if (labels && draw.showText) labels.forEach((label, index) => drawLabel(draw, node, label, index));
    if (node.changeset.id === scene.homeChangeset) drawHomeMarker(draw, node);
  }
}

function drawNode({ ctx, scene }: DrawContext, node: NodeLayout): void {
  const x = columnX(node.column);
  const y = rowY(node.row);
  const id = node.changeset.id;
  const hovered = scene.hoveredChangeset === id;
  const radius = hovered ? NODE_RADIUS + 1.5 : NODE_RADIUS;

  if (scene.searchHits.has(id)) drawHalo(ctx, x, y, radius + (scene.activeSearchHit === id ? 6 : 4), scene.palette.searchHit, 0.35);
  if (scene.selectedChangeset === id) drawHalo(ctx, x, y, radius + 5, scene.palette.accent, 0.3);

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = branchColor(scene.palette, node.changeset.branch);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = scene.selectedChangeset === id ? scene.palette.accent : scene.palette.surface;
  ctx.stroke();
}

function drawHalo(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLabel({ ctx, scene }: DrawContext, node: NodeLayout, label: GraphLabel, index: number): void {
  const x = columnX(node.column);
  const top = labelTop(rowY(node.row), index);
  ctx.save();
  ctx.font = `600 10px ${scene.palette.fontUi}`;
  const width = ctx.measureText(label.name).width + 12;

  ctx.fillStyle = scene.palette.labelBackground;
  ctx.beginPath();
  ctx.roundRect(x - width / 2, top, width, LABEL_HEIGHT, 4);
  ctx.fill();
  ctx.fillStyle = scene.palette.labelText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.name, x, top + LABEL_HEIGHT / 2 + 0.5);
  ctx.restore();
}

/** Marks the changeset the workspace is on: a ring and a small house badge below it. */
function drawHomeMarker({ ctx, scene }: DrawContext, node: NodeLayout): void {
  const x = columnX(node.column);
  const y = rowY(node.row);
  const { accent, surface } = scene.palette;

  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, NODE_RADIUS + 4, 0, Math.PI * 2);
  ctx.stroke();

  const badgeY = y + NODE_RADIUS + 14;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(x, badgeY, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = surface;
  ctx.beginPath();
  ctx.moveTo(x - 4.5, badgeY - 0.5);
  ctx.lineTo(x, badgeY - 4.5);
  ctx.lineTo(x + 4.5, badgeY - 0.5);
  ctx.lineTo(x + 3, badgeY - 0.5);
  ctx.lineTo(x + 3, badgeY + 3.5);
  ctx.lineTo(x - 3, badgeY + 3.5);
  ctx.lineTo(x - 3, badgeY - 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
