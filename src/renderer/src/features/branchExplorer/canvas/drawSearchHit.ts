import { pingRings } from './searchPing';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Marks a changeset found by a search with a soft glow. The current hit also gets a ring and,
 * as it arrives, a short sonar ping (`ping` 0 → 1) that draws the eye to it.
 */
export function drawNodeHit(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, current: boolean, ping: number): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.globalAlpha *= current ? 0.5 : 0.4;
  ctx.beginPath();
  ctx.arc(x, y, radius + (current ? 10 : 7), 0, Math.PI * 2);
  ctx.fill();
  if (current) {
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
    ctx.stroke();
    for (const ring of pingRings(ping)) {
      ctx.globalAlpha = ring.alpha;
      ctx.lineWidth = ring.width;
      ctx.beginPath();
      ctx.arc(x, y, radius + 4 + ring.grow, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** The same treatment for a branch header card or a label pill: a glow behind, a ring and ping when current. */
export function drawRectHit(ctx: CanvasRenderingContext2D, rect: Rect, cornerRadius: number, color: string, current: boolean, ping: number): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.globalAlpha = current ? 0.45 : 0.35;
  roundRect(ctx, rect, current ? 5 : 3.5, cornerRadius);
  ctx.fill();
  if (current) {
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    roundRect(ctx, rect, 2.5, cornerRadius);
    ctx.stroke();
    for (const ring of pingRings(ping)) {
      ctx.globalAlpha = ring.alpha;
      ctx.lineWidth = ring.width;
      roundRect(ctx, rect, 2.5 + ring.grow, cornerRadius);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, { x, y, width, height }: Rect, grow: number, cornerRadius: number): void {
  ctx.beginPath();
  ctx.roundRect(x - grow, y - grow, width + grow * 2, height + grow * 2, cornerRadius + grow);
}
