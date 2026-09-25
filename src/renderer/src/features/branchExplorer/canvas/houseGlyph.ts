/**
 * The home glyph (walls, roof, a door notched into the bottom edge) on a 13-unit box centered on (x, y), scaled by
 * `scale`. One symbol for "you are here": the workspace changeset's badge and the current branch's header cap.
 */
export function strokeHouse(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, color: string, lineWidth: number): void {
  const s = scale;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 6.5 * s, y + 6.5 * s);
  ctx.lineTo(x - 6.5 * s, y - 2 * s);
  ctx.lineTo(x, y - 6.5 * s);
  ctx.lineTo(x + 6.5 * s, y - 2 * s);
  ctx.lineTo(x + 6.5 * s, y + 6.5 * s);
  ctx.lineTo(x + 1.7 * s, y + 6.5 * s);
  ctx.lineTo(x + 1.7 * s, y + 2.8 * s);
  ctx.lineTo(x - 1.7 * s, y + 2.8 * s);
  ctx.lineTo(x - 1.7 * s, y + 6.5 * s);
  ctx.closePath();
  ctx.stroke();
}
