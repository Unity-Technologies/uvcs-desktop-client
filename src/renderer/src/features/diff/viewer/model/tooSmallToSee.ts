// Whether one version shows as nothing beside the other: both share one camera framed on both (`framedBounds`), so
// sizes compare, and a model exported 100× too big beside the fixed one leaves the fixed one a speck, its pane
// looking empty. The pane then says why, and offers to frame it (`ModelDiffViewer`); the shared framing stays.

import { depthOf, FIELD_OF_VIEW, type BoundsLike, type OrbitView } from './orbitCamera';
import type { Side } from './viewLayout';

/** Smaller than this on screen, a version is too small to see: a speck, its pane looking empty. */
const TINY_PIXELS = 12;
/** From this size on screen, a version shows: its pane isn't empty. */
const SHOWN_PIXELS = 48;

export interface TooSmall {
  side: Side;
  /** How many times smaller it is than the other version. */
  times: number;
}

/**
 * The version too small to see from `view` while the other shows, on a stage `stageHeight` pixels high; null when both
 * show, neither does (zoomed far out), or there's one version. Sizes are each version's bounds' sphere, in the viewer's space.
 */
export function tooSmallToSee(bounds: Record<Side, BoundsLike | null>, view: OrbitView, stageHeight: number): TooSmall | null {
  const { before, after } = bounds;
  if (!before || !after) return null;
  const [sizeBefore, sizeAfter] = [onScreen(before, view, stageHeight), onScreen(after, view, stageHeight)];
  const tiny = (size: OnScreen | null) => size !== null && size.pixels < TINY_PIXELS;
  const shows = (size: OnScreen | null) => size === null || size.pixels >= SHOWN_PIXELS;
  const ratio = radiusOf(after) / radiusOf(before);
  if (tiny(sizeBefore) && shows(sizeAfter)) return { side: 'before', times: Number(ratio.toPrecision(3)) };
  if (tiny(sizeAfter) && shows(sizeBefore)) return { side: 'after', times: Number((1 / ratio).toPrecision(3)) };
  return null;
}

/** What the pane of the version too small says. */
export function tooSmallWords(times: number): string {
  const factor = times >= 10 ? Math.round(times) : Number(times.toFixed(1));
  return `${factor}× smaller: too small to see at this size`;
}

interface OnScreen {
  pixels: number;
}

/** Its sphere's height on screen, in pixels; null when the camera is inside it, or it is behind: no size to tell. */
function onScreen(bounds: BoundsLike, view: OrbitView, stageHeight: number): OnScreen | null {
  const radius = radiusOf(bounds);
  const depth = depthOf(view, centreOf(bounds));
  if (depth <= radius) return null;
  const visibleHeight = 2 * depth * Math.tan((FIELD_OF_VIEW * Math.PI) / 360);
  return { pixels: ((2 * radius) / visibleHeight) * stageHeight };
}

function radiusOf({ min, max }: BoundsLike): number {
  return Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2;
}

function centreOf({ min, max }: BoundsLike): [number, number, number] {
  return [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
}
