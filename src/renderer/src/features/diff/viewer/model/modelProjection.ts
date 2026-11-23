// Where a point of a version's scene shows on the canvas: what places a comment's bubble over a model, every frame the
// view draws (`ModelRenderer.screenPointOf`). The camera is set as the renderer sets it for that version's pane
// (`placeCamera`), so the bubble's tip stays on the point drawn.

import { PerspectiveCamera, Vector3 } from 'three';
import { cameraPositionOf, clipPlanesOf, FIELD_OF_VIEW, type BoundsLike, type OrbitView, type Vector } from './orbitCamera';
import type { Rect } from './viewLayout';

/** A point on the canvas, in CSS pixels from its top left, and how far it is from the camera, in the viewer's units. */
export interface ScreenPoint {
  x: number;
  y: number;
  depth: number;
}

/** The canvas: its size in CSS pixels, and the device pixels in each (the layout's rectangles are in those). */
export interface CanvasMetrics {
  width: number;
  height: number;
  pixelRatio: number;
}

/**
 * Where `point` (the viewer's space) shows in a pane (`viewport`: canvas pixels from the bottom left, as WebGL and the
 * layout count), seen through `view`; none behind the camera, which would show it mirrored in front.
 */
export function projectedPoint(point: Vector, view: OrbitView, bounds: BoundsLike, viewport: Rect, canvas: CanvasMetrics): ScreenPoint | null {
  const camera = new PerspectiveCamera(FIELD_OF_VIEW, viewport.width / Math.max(viewport.height, 1));
  const { near, far } = clipPlanesOf(view, bounds);
  camera.near = near;
  camera.far = far;
  camera.position.set(...cameraPositionOf(view));
  camera.lookAt(...view.target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const seen = new Vector3(...point).applyMatrix4(camera.matrixWorldInverse);
  // Three's cameras look down their -Z: a point at 0 or more is level with the camera or behind it.
  if (seen.z >= 0) return null;
  const ndc = new Vector3(...point).project(camera);
  const x = (viewport.x + ((ndc.x + 1) / 2) * viewport.width) / canvas.pixelRatio;
  const y = canvas.height - (viewport.y + ((ndc.y + 1) / 2) * viewport.height) / canvas.pixelRatio;
  return { x, y, depth: camera.position.distanceTo(new Vector3(...point)) };
}

/**
 * Whether something else is drawn in front of a comment's point, from what the pick under its bubble's tip found
 * (`hitDepth`; none where nothing was): a surface nearer than the point by more than a sliver of the model. The
 * sliver lets the surface the point is on, read back a hair nearer or farther, count as the point's own.
 */
export function hiddenBehind(depth: number, hitDepth: number | null, modelSize: number): boolean {
  return hitDepth !== null && hitDepth < depth - modelSize * HIDDEN_MARGIN_SHARE;
}

/** How much nearer, as a share of the model's size, a surface is before it hides a point behind it. */
const HIDDEN_MARGIN_SHARE = 0.005;
