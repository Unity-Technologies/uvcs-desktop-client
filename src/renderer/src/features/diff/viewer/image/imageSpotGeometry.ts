// Where comments sit on an image (docs/features/diff.md "Comments on images"): a spot of an image (`ImageSpot`, in its
// own pixels) on screen, the spot a click or a drag marks, and where a card beside a pin goes. Pure: every mode places
// its images in the composed frame (`anchoredOffset`) and the frame in the viewport (`ViewTransform`), and so do these.

import type { ImageSpot } from '@shared/domain/reviewConversation';
import type { Size } from './composedFrame';
import { clampPan, type Point, type ViewTransform } from './viewTransform';

/** A box in the viewport, in screen pixels: a point is one of no size. */
export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How far the pointer moves, in screen pixels, before a press is a drag marking an area rather than a click on a point. */
export const AREA_DRAG_THRESHOLD = 4;

/** Where a spot of an image shows in the viewport: the image placed at `offset` in the frame, the frame by `transform`. */
export function spotOnScreen(spot: ImageSpot, offset: Point, transform: ViewTransform): ScreenRect {
  const size = spot.size ?? { width: 0, height: 0 };
  return {
    x: transform.x + (offset.x + spot.x) * transform.scale,
    y: transform.y + (offset.y + spot.y) * transform.scale,
    width: size.width * transform.scale,
    height: size.height * transform.scale,
  };
}

/**
 * The spot a press at `start` and a release at `end` mark on an image (viewport points): a click, the pixel under it;
 * a drag, the whole pixels it spans, kept within the image. None for a press off the image: a comment is on the image,
 * not on the empty frame around a smaller revision.
 */
export function spotOfGesture(start: Point, end: Point, transform: ViewTransform, offset: Point, image: Size): ImageSpot | null {
  const from = imagePointAt(start, transform, offset);
  if (from.x < 0 || from.y < 0 || from.x >= image.width || from.y >= image.height) return null;
  if (Math.hypot(end.x - start.x, end.y - start.y) < AREA_DRAG_THRESHOLD) return { x: Math.floor(from.x), y: Math.floor(from.y) };
  const to = imagePointAt(end, transform, offset);
  const left = Math.floor(clamp(Math.min(from.x, to.x), 0, image.width));
  const top = Math.floor(clamp(Math.min(from.y, to.y), 0, image.height));
  const right = Math.ceil(clamp(Math.max(from.x, to.x), 0, image.width));
  const bottom = Math.ceil(clamp(Math.max(from.y, to.y), 0, image.height));
  return { x: left, y: top, size: { width: Math.max(1, right - left), height: Math.max(1, bottom - top) } };
}

/** The point of the image under a point of the viewport, in its pixels, fractions kept. */
function imagePointAt(point: Point, transform: ViewTransform, offset: Point): Point {
  return { x: (point.x - transform.x) / transform.scale - offset.x, y: (point.y - transform.y) / transform.scale - offset.y };
}

/** Room left between a card and its pin, and between a card and the viewport's edges. */
const CARD_GAP = 12;
const CARD_MARGIN = 8;

/**
 * Where a card beside a pin or an area goes, its top-left corner in the viewport: to the right, its top level with the
 * spot's; on the left when the right has no room; over the spot when neither has; always within the viewport, its
 * height left to scroll inside it (`maxHeight`).
 */
export function cardPlacement(target: ScreenRect, viewport: Size, cardWidth: number): { left: number; top: number; maxHeight: number } {
  const right = target.x + target.width + CARD_GAP;
  const left = target.x - CARD_GAP - cardWidth;
  const fitsRight = right + cardWidth <= viewport.width - CARD_MARGIN;
  const fitsLeft = left >= CARD_MARGIN;
  const x = fitsRight ? right : fitsLeft ? left : clamp(target.x, CARD_MARGIN, viewport.width - cardWidth - CARD_MARGIN);
  const maxHeight = Math.max(viewport.height - CARD_MARGIN * 2, 0);
  const top = clamp(target.y, CARD_MARGIN, Math.max(CARD_MARGIN, viewport.height - CARD_MARGIN - Math.min(maxHeight, MIN_CARD_ROOM)));
  return { left: Math.max(x, CARD_MARGIN), top, maxHeight: Math.max(viewport.height - CARD_MARGIN - top, 0) };
}

/** The room a card's top keeps below it, at least: a pin near the bottom lifts its card, which would show only its header. */
const MIN_CARD_ROOM = 240;

/** Room kept around a spot brought into view. */
const SHOW_MARGIN = 48;

/**
 * The view that shows `rect` (in frame pixels), at the same zoom: unchanged when it shows already, its center brought
 * to the viewport's otherwise (within `clampPan`). Going to a comment never zooms: the reviewer keeps the zoom they
 * chose to read at.
 */
export function transformShowing(transform: ViewTransform, viewport: Size, frame: Size, rect: Point & Size): ViewTransform {
  const screen = spotOnScreen({ x: rect.x, y: rect.y, size: rect }, { x: 0, y: 0 }, transform);
  const shows =
    screen.x >= SHOW_MARGIN && screen.y >= SHOW_MARGIN && screen.x + screen.width <= viewport.width - SHOW_MARGIN && screen.y + screen.height <= viewport.height - SHOW_MARGIN;
  if (shows) return transform;
  const centered = {
    scale: transform.scale,
    x: viewport.width / 2 - (rect.x + rect.width / 2) * transform.scale,
    y: viewport.height / 2 - (rect.y + rect.height / 2) * transform.scale,
  };
  return clampPan(centered, viewport, frame);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** A spot in the composed frame, its image placed at `offset`: a point is one pixel, so a view brought to it frames one. */
export function spotInFrame(spot: ImageSpot, offset: Point): Point & Size {
  return { x: offset.x + spot.x, y: offset.y + spot.y, width: Math.max(1, spot.size?.width ?? 1), height: Math.max(1, spot.size?.height ?? 1) };
}
