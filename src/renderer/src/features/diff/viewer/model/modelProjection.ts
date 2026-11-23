// Where a point of a version's scene shows on the canvas: what places a comment's bubble over a model, every frame the
// view draws (`ModelRenderer.screenProjectorOf`). The camera is set as the renderer sets it for that version's pane
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

/** Where a point of the viewer's space shows on the canvas; none behind the camera or off its pane. */
export type Projector = (point: Vector) => ScreenPoint | null;

/**
 * Where points (the viewer's space) show in a pane (`viewport`: canvas pixels from the bottom left, as WebGL and the
 * layout count), seen through `view`; none behind the camera, which would show them mirrored in front, nor off the
 * pane, which in Split is over the other version. The camera is built once for every point: a frame projects each pin
 * with one per pane.
 */
export function projectorOf(view: OrbitView, bounds: BoundsLike, viewport: Rect, canvas: CanvasMetrics): Projector {
  const camera = new PerspectiveCamera(FIELD_OF_VIEW, viewport.width / Math.max(viewport.height, 1));
  const { near, far } = clipPlanesOf(view, bounds);
  camera.near = near;
  camera.far = far;
  camera.position.set(...cameraPositionOf(view));
  camera.lookAt(...view.target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const seen = new Vector3();
  return (point) => {
    // Three's cameras look down their -Z: a point at 0 or more is level with the camera or behind it.
    if (seen.set(...point).applyMatrix4(camera.matrixWorldInverse).z >= 0) return null;
    const ndc = seen.set(...point).project(camera);
    // Off the pane: in Split the canvas goes on past it, into the other version's pane.
    if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1) return null;
    const x = (viewport.x + ((ndc.x + 1) / 2) * viewport.width) / canvas.pixelRatio;
    const y = canvas.height - (viewport.y + ((ndc.y + 1) / 2) * viewport.height) / canvas.pixelRatio;
    return { x, y, depth: camera.position.distanceTo(seen.set(...point)) };
  };
}

/** How far from the camera the surface a pick hit is; none where it hit nothing. */
export function depthOfHit(hit: { point: Vector | null } | null, camera: Vector): number | null {
  return hit?.point ? Math.hypot(...hit.point.map((value, i) => value - camera[i]!)) : null;
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

/**
 * A pane's rectangle on the canvas in CSS pixels from its top left, from its viewport (canvas pixels from the bottom
 * left, as WebGL and the layout count): where a version's pins are clipped, so in Split none crosses into the other's.
 */
export function paneOnCanvas(viewport: Rect, canvas: CanvasMetrics): Rect {
  const { pixelRatio } = canvas;
  return { x: viewport.x / pixelRatio, y: canvas.height - (viewport.y + viewport.height) / pixelRatio, width: viewport.width / pixelRatio, height: viewport.height / pixelRatio };
}
