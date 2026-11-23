// Where a comment's pin and its card go on screen, over an image or a 3D model alike: the bubble above its tip, and the
// card beside it, never over what it's about where there's room elsewhere. Pure: each viewer works out where a spot
// shows (`spotOnScreen`, a model's projection) and these place what goes around it.

import type { Size } from '../image/composedFrame';

/** A box in the viewport, in screen pixels: a point is one of no size. */
export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A pin's bubble: its tip on the spot's top-left corner, the bubble above it (`CommentPins.module.css`). */
export const PIN_SIZE = 30;

/** What a pin covers on screen, its bubble and its area: a card placed beside it leaves it all in view. */
export function pinBounds(spot: ScreenRect): ScreenRect {
  return { x: spot.x, y: spot.y - PIN_SIZE, width: Math.max(spot.width, PIN_SIZE), height: spot.height + PIN_SIZE };
}

/** Room left between a card and its pin, and between a card and the viewport's edges. */
const CARD_GAP = 12;
const CARD_MARGIN = 8;

/** The least room a card takes below or above its spot: less, and it would show only its header. */
const MIN_CARD_ROOM = 200;

/** Where a card goes in the viewport: its left edge, and its top or its bottom edge, its height capped to the room. */
export type CardPlacement = { left: number; maxHeight: number } & ({ top: number } | { bottom: number });

/**
 * Where a card beside a pin or an area goes, never over what it's about where there's room elsewhere: to the right,
 * its top level with the spot's; else on the left; else below the spot, or above it, whichever has more room; over it
 * only when none has. `viewport` is the room cards may take: the stage's floating controls are left out of it.
 */
export function cardPlacement(target: ScreenRect, viewport: Size, cardWidth: number): CardPlacement {
  const fullHeight = Math.max(viewport.height - CARD_MARGIN * 2, 0);
  const levelTop = clamp(target.y, CARD_MARGIN, Math.max(CARD_MARGIN, viewport.height - CARD_MARGIN - Math.min(fullHeight, MIN_CARD_ROOM)));
  const beside = { top: levelTop, maxHeight: Math.max(viewport.height - CARD_MARGIN - levelTop, 0) };
  const right = target.x + target.width + CARD_GAP;
  if (right + cardWidth <= viewport.width - CARD_MARGIN) return { left: right, ...beside };
  const left = target.x - CARD_GAP - cardWidth;
  if (left >= CARD_MARGIN) return { left, ...beside };
  const centered = clamp(target.x, CARD_MARGIN, Math.max(CARD_MARGIN, viewport.width - cardWidth - CARD_MARGIN));
  const below = target.y + target.height + CARD_GAP;
  const roomBelow = viewport.height - CARD_MARGIN - below;
  const roomAbove = target.y - CARD_GAP - CARD_MARGIN;
  if (roomBelow >= MIN_CARD_ROOM && roomBelow >= roomAbove) return { left: centered, top: below, maxHeight: roomBelow };
  if (roomAbove >= MIN_CARD_ROOM) return { left: centered, bottom: viewport.height - target.y + CARD_GAP, maxHeight: roomAbove };
  return { left: centered, ...beside };
}

/** A card's width beside its pin: a thread reads as it does under a line of code, at a reading width. */
export const PIN_CARD_WIDTH = 360;

/** The width the stage's floating controls take at the viewport's right edge, with their margin. */
const STAGE_CONTROLS_ROOM = 52;

/**
 * Where the card of a pin at `rect` goes in a viewer's stage (`cardPlacement`, its bubble included: `pinBounds`, and
 * what else it's about: `about`, a model's part on screen), never under the stage's floating controls at its right
 * edge (`StageControls`).
 */
export function pinCardPlacement(rect: ScreenRect, viewport: Size, about: ScreenRect | null = null): CardPlacement {
  const bounds = pinBounds(rect);
  return cardPlacement(about ? unionOf(bounds, about) : bounds, { width: viewport.width - STAGE_CONTROLS_ROOM, height: viewport.height }, PIN_CARD_WIDTH);
}

/** The box around two boxes. */
export function unionOf(a: ScreenRect, b: ScreenRect): ScreenRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
}

/** The box around points on screen; none for no points. */
export function boundsOf(points: readonly { x: number; y: number }[]): ScreenRect | null {
  if (points.length === 0) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
