// The model viewer's camera, as plain numbers: it orbits a target at a distance, yawing around Unity's up (Y) and
// pitching over it, as Unity's Scene view does. Every mode draws both versions through the one view, so switching
// modes keeps the framing; these functions make each gesture's next view, and the renderer only places the camera.

export type Vector = [number, number, number];

export interface OrbitView {
  target: Vector;
  /** Around Y, in radians; 0 looks from +Z, the model's front in Unity (its forward). */
  yaw: number;
  /** Over the target, in radians; positive looks down at it. */
  pitch: number;
  distance: number;
}

export interface BoundsLike {
  min: Vector;
  max: Vector;
}

/** The vertical field of view, in degrees: a touch narrower than Unity's 60, so a model reads with little distortion. */
export const FIELD_OF_VIEW = 35;
/** The first look: from the front, a little to the right and above, as a model is shown in a store. */
export const FIRST_YAW = (30 * Math.PI) / 180;
export const FIRST_PITCH = (18 * Math.PI) / 180;
const MAX_PITCH = (89 * Math.PI) / 180;
/** How much room is left around a framed model. */
const FRAMING_MARGIN = 1.15;
/** Radians per pixel dragged; a drag across a 600 px view turns the model about 200°. */
const ORBIT_SPEED = 0.006;
/** How fast a trackpad zooms: 100 px of scroll bring the camera about a fifth closer. */
const DOLLY_SPEED = 0.002;
export const MIN_DISTANCE = 1e-4;

/** A view that frames the bounds whole in a viewport of `aspect` (width over height), from `yaw` and `pitch`. */
export function framedView(bounds: BoundsLike, aspect: number, yaw = FIRST_YAW, pitch = FIRST_PITCH): OrbitView {
  const target = centreOf(bounds);
  const radius = Math.max(radiusOf(bounds), MIN_DISTANCE);
  const vertical = (FIELD_OF_VIEW * Math.PI) / 360;
  const horizontal = Math.atan(Math.tan(vertical) * Math.max(aspect, 1e-3));
  const distance = (radius * FRAMING_MARGIN) / Math.sin(Math.min(vertical, horizontal));
  return { target, yaw, pitch, distance };
}

export function orbited(view: OrbitView, dx: number, dy: number): OrbitView {
  const pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, view.pitch + dy * ORBIT_SPEED));
  return { ...view, yaw: view.yaw - dx * ORBIT_SPEED, pitch };
}

/** The target moved with the pointer: what was under it stays under it, at the target's depth. */
export function panned(view: OrbitView, dx: number, dy: number, viewportHeight: number): OrbitView {
  const perPixel = (2 * view.distance * Math.tan((FIELD_OF_VIEW * Math.PI) / 360)) / Math.max(viewportHeight, 1);
  const { right, up } = axesOf(view);
  const target = view.target.map((value, i) => value - right[i]! * dx * perPixel + up[i]! * dy * perPixel) as Vector;
  return { ...view, target };
}

/**
 * Closer or farther by a trackpad's or a pinch's `deltaY` (a wheel's notches glide: `dollyGlide`), towards `point`
 * when there is one (`dolliedTo`).
 */
export function dollied(view: OrbitView, deltaY: number, point: Vector | null = null): OrbitView {
  return dolliedTo(view, view.distance * Math.exp(deltaY * DOLLY_SPEED), point);
}

/**
 * The view at `distance`, towards `point` (what is under the pointer, in the viewer's space) when there is one: the
 * target moves as much of the way to it as the distance shrinks, so that point stays put.
 */
export function dolliedTo(view: OrbitView, distance: number, point: Vector | null): OrbitView {
  const closer = Math.max(distance, MIN_DISTANCE);
  if (!point) return { ...view, distance: closer };
  const pull = 1 - closer / view.distance;
  const target = view.target.map((value, i) => value + (point[i]! - value) * pull) as Vector;
  return { ...view, target, distance: closer };
}

export function cameraPositionOf(view: OrbitView): Vector {
  const { yaw, pitch, distance, target } = view;
  return [target[0] + distance * Math.cos(pitch) * Math.sin(yaw), target[1] + distance * Math.sin(pitch), target[2] + distance * Math.cos(pitch) * Math.cos(yaw)];
}

/** Clip planes that hold the bounds from where the camera is: near as far out as it can be, so depth stays precise. */
export function clipPlanesOf(view: OrbitView, bounds: BoundsLike): { near: number; far: number } {
  const radius = Math.max(radiusOf(bounds), MIN_DISTANCE);
  const camera = cameraPositionOf(view);
  const centre = centreOf(bounds);
  const toCentre = Math.hypot(...camera.map((value, i) => value - centre[i]!));
  const far = (toCentre + radius) * 2;
  return { near: Math.max(toCentre - radius, far / 10000, MIN_DISTANCE / 10), far };
}

/** The camera's right and up, as unit vectors in the viewer's space. */
function axesOf(view: OrbitView): { right: Vector; up: Vector } {
  const { yaw, pitch } = view;
  const right: Vector = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const up: Vector = [-Math.sin(pitch) * Math.sin(yaw), Math.cos(pitch), -Math.sin(pitch) * Math.cos(yaw)];
  return { right, up };
}

function centreOf(bounds: BoundsLike): Vector {
  return bounds.min.map((value, i) => (value + bounds.max[i]!) / 2) as Vector;
}

function radiusOf(bounds: BoundsLike): number {
  return Math.hypot(...bounds.max.map((value, i) => value - bounds.min[i]!)) / 2;
}
