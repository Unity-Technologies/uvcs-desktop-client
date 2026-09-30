// Where the composed frame shows in a viewport, and how zooming and panning move it: the geometry `usePanZoom` and the
// pixel inspector run on. Pure; `viewport` is the pane's size on screen, `image` the composed frame's in pixels.

import type { Size } from './imageDiff';

/** How the composed frame shows: scaled by `scale`, its top-left corner at (x, y) in the viewport. */
export interface ViewTransform {
  scale: number;
  x: number;
  y: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Deep enough to tell pixels apart, shallow enough to find a tiny thumbnail again. */
export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 64;

/** What the zoom buttons and keys multiply or divide the scale by. */
export const ZOOM_STEP = 1.5;

/** Stepping to a changed region never zooms past this: a 2-pixel nick fills part of the pane, not a wall of 4 texels. */
const REGION_MAX_ZOOM = 16;

/** Room kept around the image when fitting it, and around a region when zooming to it. */
const FIT_MARGIN = 24;
const REGION_MARGIN = 48;

/** The most one wheel event zooms by, in pixels of delta: a mouse notch (±100 or so) zooms about 1.2×. */
const MAX_WHEEL_ZOOM_DELTA = 16;
/** The zoom's speed per pixel of wheel delta, exponential so a pinch feels the same at any scale. */
const WHEEL_ZOOM_RATE = 0.012;
/** A wheel delta in lines or pages (some mice) counts as this many pixels a unit. */
const WHEEL_UNIT_PIXELS = 16;

export function clampZoom(scale: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

/** The scale that fits the image in the viewport with a margin, never above 100%: a 16×16 icon blown up reads as a bug. */
export function fitZoom(viewport: Size, image: Size): number {
  if (image.width <= 0 || image.height <= 0) return 1;
  return clampZoom(Math.min(spaceIn(viewport.width, FIT_MARGIN) / image.width, spaceIn(viewport.height, FIT_MARGIN) / image.height, 1));
}

/** The image at `scale`, centered in the viewport. */
export function centeredTransform(scale: number, viewport: Size, image: Size): ViewTransform {
  return { scale, x: (viewport.width - image.width * scale) / 2, y: (viewport.height - image.height * scale) / 2 };
}

/** The image fitted and centered: how every image first shows. */
export function fittedTransform(viewport: Size, image: Size): ViewTransform {
  return centeredTransform(fitZoom(viewport, image), viewport, image);
}

/**
 * Keeps the image from being lost: an axis where the scaled image fits stays centered, a larger one pans as far as its
 * edges and no further.
 */
export function clampPan(transform: ViewTransform, viewport: Size, image: Size): ViewTransform {
  const width = image.width * transform.scale;
  const height = image.height * transform.scale;
  return {
    scale: transform.scale,
    x: width <= viewport.width ? (viewport.width - width) / 2 : Math.min(0, Math.max(viewport.width - width, transform.x)),
    y: height <= viewport.height ? (viewport.height - height) / 2 : Math.min(0, Math.max(viewport.height - height, transform.y)),
  };
}

/** The view moved by (dx, dy) screen pixels, within `clampPan`. */
export function pannedBy(transform: ViewTransform, dx: number, dy: number, viewport: Size, image: Size): ViewTransform {
  return clampPan({ scale: transform.scale, x: transform.x + dx, y: transform.y + dy }, viewport, image);
}

/** Zoomed to `scale` around a point of the viewport (the pointer): the image pixel under it stays under it. */
export function zoomAroundPoint(transform: ViewTransform, scale: number, anchor: Point, viewport: Size, image: Size): ViewTransform {
  const nextScale = clampZoom(scale);
  const ratio = nextScale / transform.scale;
  return clampPan({ scale: nextScale, x: anchor.x - (anchor.x - transform.x) * ratio, y: anchor.y - (anchor.y - transform.y) * ratio }, viewport, image);
}

/**
 * Centers `rect` (in image pixels) in the viewport, zoomed to fill it with a margin. Unlike `fitZoom` it zooms in past
 * 100%, as stepping to a small changed region is for, up to `REGION_MAX_ZOOM`.
 */
export function rectTransform(viewport: Size, rect: Point & Size): ViewTransform {
  const scale = clampZoom(
    Math.min(spaceIn(viewport.width, REGION_MARGIN) / Math.max(rect.width, 1), spaceIn(viewport.height, REGION_MARGIN) / Math.max(rect.height, 1), REGION_MAX_ZOOM),
  );
  return {
    scale,
    x: viewport.width / 2 - (rect.x + rect.width / 2) * scale,
    y: viewport.height / 2 - (rect.y + rect.height / 2) * scale,
  };
}

/**
 * The scale a zooming wheel event (a pinch, or the wheel with ⌘ or Ctrl) goes to. A trackpad pinch streams small
 * deltas, a mouse notch one big one: each event's delta is capped, so a notch is a gentle step and a pinch unchanged.
 */
export function wheelZoomScale(scale: number, deltaY: number, deltaInPixels: boolean): number {
  const pixels = deltaInPixels ? deltaY : deltaY * WHEEL_UNIT_PIXELS;
  const capped = Math.max(-MAX_WHEEL_ZOOM_DELTA, Math.min(MAX_WHEEL_ZOOM_DELTA, pixels));
  return scale * Math.exp(-capped * WHEEL_ZOOM_RATE);
}

/** A double click below 100% zooms to actual size, into the click; at or above it, back to fit. */
export function doubleClickZoomsIn(scale: number): boolean {
  return scale < 0.999;
}

/** The composed frame's pixel under a point of the viewport, or null off the image. */
export function framePixelAt(point: Point, transform: ViewTransform, image: Size): Point | null {
  const x = Math.floor((point.x - transform.x) / transform.scale);
  const y = Math.floor((point.y - transform.y) / transform.scale);
  return x < 0 || x >= image.width || y < 0 || y >= image.height ? null : { x, y };
}

/** The zoom as the controls say it: 100%, 33%, 6.3%, 1600%. */
export function zoomLabel(scale: number): string {
  const percent = scale * 100;
  return `${percent >= 10 ? Math.round(percent) : percent.toFixed(1)}%`;
}

function spaceIn(length: number, margin: number): number {
  return Math.max(length - margin * 2, 1);
}
