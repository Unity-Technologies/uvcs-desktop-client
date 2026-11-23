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

/**
 * Where a card goes in the viewport: its left edge and its width (narrower than asked where the viewport is), and its
 * top or its bottom edge, its height capped to the room.
 */
export type CardPlacement = { left: number; width: number; maxHeight: number } & ({ top: number } | { bottom: number });

/**
 * Where a card beside a pin or an area goes, never over what it's about where there's room elsewhere: to the right,
 * its top level with the spot's; else on the left; else below the spot, or above it, whichever has more room; over it
 * only when none has. `viewport` is the room cards may take: the stage's floating controls are left out of it. A
 * viewport narrower than the card narrows it, within its margins: past its edge the card would be cut off.
 */
export function cardPlacement(target: ScreenRect, viewport: Size, cardWidth: number): CardPlacement {
  const width = Math.max(Math.min(cardWidth, viewport.width - CARD_MARGIN * 2), 0);
  const fullHeight = Math.max(viewport.height - CARD_MARGIN * 2, 0);
  const levelTop = clamp(target.y, CARD_MARGIN, Math.max(CARD_MARGIN, viewport.height - CARD_MARGIN - Math.min(fullHeight, MIN_CARD_ROOM)));
  const beside = { width, top: levelTop, maxHeight: Math.max(viewport.height - CARD_MARGIN - levelTop, 0) };
  const right = target.x + target.width + CARD_GAP;
  if (right + width <= viewport.width - CARD_MARGIN) return { left: right, ...beside };
  const left = target.x - CARD_GAP - width;
  if (left >= CARD_MARGIN) return { left, ...beside };
  const centered = clamp(target.x, CARD_MARGIN, Math.max(CARD_MARGIN, viewport.width - width - CARD_MARGIN));
  const below = target.y + target.height + CARD_GAP;
  const roomBelow = viewport.height - CARD_MARGIN - below;
  const roomAbove = target.y - CARD_GAP - CARD_MARGIN;
  if (roomBelow >= MIN_CARD_ROOM && roomBelow >= roomAbove) return { left: centered, width, top: below, maxHeight: roomBelow };
  if (roomAbove >= MIN_CARD_ROOM) return { left: centered, width, bottom: viewport.height - target.y + CARD_GAP, maxHeight: roomAbove };
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
  return cardPlacement(pinTargetOf(rect, about), { width: viewport.width - STAGE_CONTROLS_ROOM, height: viewport.height }, PIN_CARD_WIDTH);
}

/** What a pin's card keeps clear of: the pin's bubble and spot (`pinBounds`), and what else it's about. */
export function pinTargetOf(rect: ScreenRect, about: ScreenRect | null = null): ScreenRect {
  const bounds = pinBounds(rect);
  return about ? unionOf(bounds, about) : bounds;
}

/**
 * Where the card of a pin at `rect` in one of the stage's panes (`pane`, its box on the stage: Split's two halves, or
 * the whole stage) goes over the whole stage (`pinCardPlacement`): a narrow pane's card may reach over the other pane,
 * rather than being cut off at its edge. None while the spot is out of its pane, panned or zoomed away: the card hides
 * with nothing to point at, as a model's does, and shows again as it was (a reply being written in it kept) once the
 * spot is back.
 */
export function stageCardPlacement(rect: ScreenRect, pane: ScreenRect, stage: Size): CardPlacement | null {
  if (!spotInPane(rect, pane)) return null;
  return pinCardPlacement({ ...rect, x: rect.x + pane.x, y: rect.y + pane.y }, stage);
}

/** Whether any of a spot (a point, or an area) shows in a pane of its size, its edges included. */
function spotInPane(spot: ScreenRect, pane: Size): boolean {
  return spot.x <= pane.width && spot.y <= pane.height && spot.x + spot.width >= 0 && spot.y + spot.height >= 0;
}

/** How far a pin a take moves may stray from its card, each way, before the card follows it. */
const CARD_LEASH = 96;

/** A card where it was placed (`placement`), and the box it took on screen there (`box`). */
export interface HeldCard {
  placement: CardPlacement;
  box: ScreenRect;
}

/**
 * Where a card goes as what it's about moves on screen (`target`: its pin's bounds, and its part's): where it was held
 * while only a take moves it under a still view, so that a part swaying doesn't make the card wobble with it, as long
 * as the target stays clear of the card and within `CARD_LEASH` of it; else, or once the view moves (`viewMoved`: a
 * turn, a zoom, a resize), placed afresh (`next`).
 */
export function keptCardPlacement(held: HeldCard | null, next: CardPlacement, target: ScreenRect, viewMoved: boolean): CardPlacement {
  if (!held || viewMoved) return next;
  const gapX = Math.max(held.box.x - (target.x + target.width), target.x - (held.box.x + held.box.width));
  const gapY = Math.max(held.box.y - (target.y + target.height), target.y - (held.box.y + held.box.height));
  const covers = gapX < 0 && gapY < 0;
  return covers || gapX > CARD_LEASH || gapY > CARD_LEASH ? next : held.placement;
}

/** What a model's camera looks from, as `OrbitView` has it: the pins module stays apart from the model's. */
interface CameraView {
  target: readonly number[];
  yaw: number;
  pitch: number;
  distance: number;
}

/**
 * The view a card was placed in, as one string: the camera, every part of it, and the panes the versions are drawn
 * in. It changes on a turn, a pan, a zoom, a resize or a mode, never as a take plays, so a card that keeps its place
 * while a take moves its pin (`keptCardPlacement`) follows it as soon as it differs.
 */
export function viewKeyOf(view: CameraView, panes: readonly (ScreenRect | null)[]): string {
  return JSON.stringify([view.target, view.yaw, view.pitch, view.distance, panes.map((pane) => pane && [pane.x, pane.y, pane.width, pane.height])]);
}

/**
 * Whether a card being hidden (its pin out of view) hands the focus to its stage: when it holds it, as a hidden card
 * can't take keys, and they'd go nowhere. The stage keeps its own keys working (zoom, C), and the card's text stays.
 */
export function focusLeavesHiddenCard(hidden: boolean, focusInCard: boolean): boolean {
  return hidden && focusInCard;
}

/** A card's place as the style of its element: its edges and sizes, in pixels. */
export function cardStyleOf(placement: CardPlacement): { left: string; width: string; maxHeight: string; top: string; bottom: string } {
  return {
    left: `${placement.left}px`,
    width: `${placement.width}px`,
    maxHeight: `${placement.maxHeight}px`,
    top: 'top' in placement ? `${placement.top}px` : '',
    bottom: 'bottom' in placement ? `${placement.bottom}px` : '',
  };
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
