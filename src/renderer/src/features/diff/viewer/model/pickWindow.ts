// Where a pick looks, in a pane: the point under the pointer as the camera sees it (normalized device coordinates, the
// ray's), and the one-pixel window around it that `MeshPicker` draws, as three's `setViewOffset` takes it (device
// pixels from the pane's top left). The window is centred on the very point, not on the pixel holding it, so the
// surface it reads is where the ray meets it.

import type { Rect } from './viewLayout';

export interface PickWindow {
  /** The point in normalized device coordinates: -1 to 1 across the pane, up positive. */
  ndc: [number, number];
  /** The pane's size in device pixels, and the one-pixel window's top left in it. */
  full: { width: number; height: number };
  offset: { x: number; y: number };
}

/**
 * The window under (`x`, `y`), CSS pixels from the canvas's top left, in a pane whose `viewport` is in device pixels
 * from the canvas's bottom left (GL's), on a canvas `height` CSS pixels high.
 */
export function pickWindowAt(x: number, y: number, viewport: Rect, height: number, pixelRatio: number): PickWindow {
  const fromLeft = x * pixelRatio - viewport.x;
  const fromBottom = (height - y) * pixelRatio - viewport.y;
  const fromTop = viewport.height - fromBottom;
  return {
    ndc: [(fromLeft / viewport.width) * 2 - 1, (fromBottom / viewport.height) * 2 - 1],
    full: { width: viewport.width, height: viewport.height },
    offset: { x: fromLeft - 0.5, y: fromTop - 0.5 },
  };
}

/**
 * What the picking pass read at the window (`MeshPicker`): the mesh drawn there, by its place among the side's meshes,
 * and the point of its surface, in the viewer's space; null where nothing was drawn. The pass writes the point in red,
 * green and blue, and the mesh's place plus one in alpha, over a clear of zeros.
 */
export function pickedAt(pixel: Float32Array, normalPixel: Float32Array | null): { mesh: number; point: [number, number, number]; normal: [number, number, number] | null } | null {
  const mesh = Math.round(pixel[3]!) - 1;
  return mesh < 0 ? null : { mesh, point: [pixel[0]!, pixel[1]!, pixel[2]!], normal: normalPixel ? normalAt(normalPixel) : null };
}

/**
 * The surface's direction at the point picked, as the pass writes it in its second pixel (red, green, blue: towards
 * the camera, in the viewer's space); none where it wrote none (a degenerate face, a GPU that left it blank).
 */
export function normalAt(pixel: Float32Array): [number, number, number] | null {
  const length = Math.hypot(pixel[0]!, pixel[1]!, pixel[2]!);
  return length > 1e-6 ? [pixel[0]! / length, pixel[1]! / length, pixel[2]! / length] : null;
}
