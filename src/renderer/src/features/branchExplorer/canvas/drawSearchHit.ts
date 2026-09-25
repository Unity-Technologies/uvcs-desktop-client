import type { DrawContext } from './drawContext';
import { pingRings } from './searchPing';

/** A hit's halo blur, in world px so it grows and shrinks with the graph. */
const HIT_GLOW = 9;
/** The current hit's halo reaches further: "you are here" among the hits. */
const ACTIVE_GLOW = 16;
/** The current hit's ring sits this far outside the shape, like the selection ring. */
const CORONA_GAP = 4;
const RECT_CORONA_GAP = 2.5;

/**
 * The warm halo every search hit wears, the same for a changeset, a branch header or a label: a soft shadow
 * cast by the shape itself, which the opaque body drawn on top then covers, leaving only the glow. Canvas
 * blurs in device pixels, so the blur is scaled by the zoom to keep a constant world size.
 */
function castGlow({ ctx, scene, pixelRatio }: DrawContext, current: boolean): void {
  const { palette, viewport } = scene;
  ctx.globalAlpha = current ? 0.9 : 0.6;
  ctx.shadowColor = palette.searchHit;
  ctx.shadowBlur = (current ? ACTIVE_GLOW : HIT_GLOW) * pixelRatio * viewport.zoom;
  ctx.fillStyle = palette.searchHit;
}

export function drawNodeGlow(draw: DrawContext, x: number, y: number, radius: number, current: boolean): void {
  const { ctx } = draw;
  ctx.save();
  castGlow(draw, current);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The current hit's ring, and while it arrives a short sonar ping (two staggered rings) that draws the eye to it. */
export function drawNodeCorona({ ctx, scene }: DrawContext, x: number, y: number, radius: number): void {
  ctx.save();
  ctx.strokeStyle = scene.palette.searchHit;
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius + CORONA_GAP, 0, Math.PI * 2);
  ctx.stroke();
  for (const ring of pingRings(scene.searchPing)) {
    ctx.globalAlpha = ring.alpha;
    ctx.lineWidth = ring.width;
    ctx.beginPath();
    ctx.arc(x, y, radius + CORONA_GAP + ring.grow, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawRectGlow(draw: DrawContext, x: number, y: number, width: number, height: number, cornerRadius: number, current: boolean): void {
  const { ctx } = draw;
  ctx.save();
  castGlow(draw, current);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, cornerRadius);
  ctx.fill();
  ctx.restore();
}

/** The rectangular twin of the node corona, for branch headers and labels. */
export function drawRectCorona({ ctx, scene }: DrawContext, x: number, y: number, width: number, height: number, cornerRadius: number): void {
  ctx.save();
  ctx.strokeStyle = scene.palette.searchHit;
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  strokeGrown(ctx, x, y, width, height, cornerRadius, RECT_CORONA_GAP);
  for (const ring of pingRings(scene.searchPing)) {
    ctx.globalAlpha = ring.alpha;
    ctx.lineWidth = ring.width;
    strokeGrown(ctx, x, y, width, height, cornerRadius, RECT_CORONA_GAP + ring.grow);
  }
  ctx.restore();
}

function strokeGrown(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, cornerRadius: number, grow: number): void {
  ctx.beginPath();
  ctx.roundRect(x - grow, y - grow, width + grow * 2, height + grow * 2, cornerRadius + grow);
  ctx.stroke();
}
