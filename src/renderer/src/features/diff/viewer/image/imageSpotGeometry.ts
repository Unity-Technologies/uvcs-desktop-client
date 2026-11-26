// Where comments sit on an image (docs/features/diff.md "Comments on images"): a spot of an image (`ImageSpot`, in its
// own pixels) on screen, and the spot a click or a drag marks (a card beside a pin: `pinPlacement`). Pure: every mode places
// its images in the composed frame (`anchoredOffset`) and the frame in the viewport (`ViewTransform`), and so do these.

import type { ImageSpot } from '@shared/domain/reviewConversation';
import type { ScreenRect } from '../pins/pinPlacement';
import type { Size } from './composedFrame';
import { clampPan, type Point, type ViewTransform } from './viewTransform';

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
export function imagePointAt(point: Point, transform: ViewTransform, offset: Point): Point {
  return { x: (point.x - transform.x) / transform.scale - offset.x, y: (point.y - transform.y) / transform.scale - offset.y };
}

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

/**
 * What going to a pin brings into view (`transformShowing`), at the zoom shown: its whole area when it fits in the
 * viewport, else its top-left corner, where its bubble is: an area wider or taller than the view, centered, left its
 * bubble out of it.
 */
export function revealedRect(spot: Point & Size, viewport: Size, scale: number): Point & Size {
  const fits = spot.width * scale <= viewport.width - SHOW_MARGIN * 2 && spot.height * scale <= viewport.height - SHOW_MARGIN * 2;
  return fits ? spot : { x: spot.x, y: spot.y, width: 1, height: 1 };
}

/** A spot in the composed frame, its image placed at `offset`: a point is one pixel, so a view brought to it frames one. */
export function spotInFrame(spot: ImageSpot, offset: Point): Point & Size {
  return { x: offset.x + spot.x, y: offset.y + spot.y, width: Math.max(1, spot.size?.width ?? 1), height: Math.max(1, spot.size?.height ?? 1) };
}

/** A corner of an area, which a handle drags to reshape it. */
export type AreaCorner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

export const AREA_CORNERS: readonly AreaCorner[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

/** A spot moved by whole pixels of its image, kept within it: a point on a pixel of it, an area whole inside it. */
export function movedSpot(spot: ImageSpot, by: Point, image: Size): ImageSpot {
  const width = spot.size?.width ?? 1;
  const height = spot.size?.height ?? 1;
  const x = clamp(Math.round(spot.x + by.x), 0, Math.max(0, image.width - width));
  const y = clamp(Math.round(spot.y + by.y), 0, Math.max(0, image.height - height));
  return spot.size ? { x, y, size: spot.size } : { x, y };
}

/**
 * An area reshaped by dragging one of its corners to `to` (a point of the image, fractions kept): the opposite corner
 * stays, the dragged one goes to the whole pixel nearest the pointer, within the image; dragged past the other, the
 * area turns over, as it would being drawn again. At least a pixel each way.
 */
export function resizedSpot(spot: ImageSpot, corner: AreaCorner, to: Point, image: Size): ImageSpot {
  const size = spot.size ?? { width: 1, height: 1 };
  const fixedX = corner === 'topLeft' || corner === 'bottomLeft' ? spot.x + size.width : spot.x;
  const fixedY = corner === 'topLeft' || corner === 'topRight' ? spot.y + size.height : spot.y;
  const movedX = clamp(Math.round(to.x), 0, image.width);
  const movedY = clamp(Math.round(to.y), 0, image.height);
  const left = Math.min(fixedX, movedX);
  const top = Math.min(fixedY, movedY);
  const width = Math.max(1, Math.abs(movedX - fixedX));
  const height = Math.max(1, Math.abs(movedY - fixedY));
  return { x: Math.min(left, image.width - width), y: Math.min(top, image.height - height), size: { width, height } };
}

/** Where a handle on a corner of an area shows on screen. */
export function cornerPoint(rect: ScreenRect, corner: AreaCorner): Point {
  return {
    x: corner === 'topLeft' || corner === 'bottomLeft' ? rect.x : rect.x + rect.width,
    y: corner === 'topLeft' || corner === 'topRight' ? rect.y : rect.y + rect.height,
  };
}

/** The box a drag outlines between where it was pressed and where the pointer is, whichever way it goes. */
export function dragRect(start: Point, end: Point): ScreenRect {
  return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
}
