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

/** A ray from the camera through a point of the screen, its direction a unit vector. */
export interface Ray {
  origin: Vector;
  direction: Vector;
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

/**
 * The target moved with the pointer, so that what sits `depth` ahead of the camera (what the drag grabbed:
 * `workingDepth`) moves exactly with it, at any zoom: by the target's own depth, a drag that grabbed a model far
 * behind a target zoomed close to crawled under the mouse.
 */
export function panned(view: OrbitView, dx: number, dy: number, viewportHeight: number, depth = view.distance): OrbitView {
  const perPixel = (2 * depth * Math.tan((FIELD_OF_VIEW * Math.PI) / 360)) / Math.max(viewportHeight, 1);
  const { right, up } = axesOf(view);
  const target = view.target.map((value, i) => value - right[i]! * dx * perPixel + up[i]! * dy * perPixel) as Vector;
  return { ...view, target };
}

/** How far ahead of the camera `point` is, along where it looks; negative behind it. */
export function depthOf(view: OrbitView, point: Vector): number {
  const camera = cameraPositionOf(view);
  const forward = forwardOf(view);
  return point.reduce((sum, value, i) => sum + (value - camera[i]!) * forward[i]!, 0);
}

/**
 * The depth a gesture moves things at: what is under the pointer, else the model's centre, so a pan or a key moves the
 * model as far as asked whatever the orbit's target; the target's own depth when neither is ahead of the camera
 * (the camera inside the model, past its centre).
 */
export function workingDepth(view: OrbitView, grabbed: Vector | null, centre: Vector | null): number {
  for (const point of [grabbed, centre]) {
    const depth = point ? depthOf(view, point) : 0;
    if (depth > view.distance * 1e-3) return depth;
  }
  return view.distance;
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

/** How fast the keys move the camera at first: half the working depth (`workingDepth`) a second. */
const FLY_SPEED = 0.5;
/** Held, they speed up to this many times as fast, over `FLY_RAMP_SECONDS`, so a long way takes no longer to cross. */
const FLY_TOP_SPEED_UP = 5;
const FLY_RAMP_SECONDS = 1.5;
/** With Shift held. */
const FLY_FAST = 4;

/** How the held keys move the camera, each -1, 0 or 1: forward where it looks, right, and up (Unity's up, Y). */
export interface FlyMove {
  forward: number;
  right: number;
  up: number;
}

/**
 * How far the keys move the camera in a frame of `seconds`, having been held `heldSeconds`: from `FLY_SPEED` up to
 * `FLY_TOP_SPEED_UP` times it, eased in and out, so a tap nudges and holding sails.
 */
export function flyStep(depth: number, heldSeconds: number, seconds: number, fast = false): number {
  const ramp = Math.min(1, heldSeconds / FLY_RAMP_SECONDS);
  const speedUp = 1 + (FLY_TOP_SPEED_UP - 1) * ramp * ramp * (3 - 2 * ramp);
  return depth * FLY_SPEED * speedUp * (fast ? FLY_FAST : 1) * seconds;
}

/**
 * The camera moved `step` by the keys, as Unity's Scene view moves it with WASD, QE: forward where it looks (down,
 * when it looks down), right, and straight up; the target goes with it, so it still turns around what is ahead.
 */
export function flown(view: OrbitView, move: FlyMove, step: number): OrbitView {
  const { right } = axesOf(view);
  const forward = forwardOf(view);
  const target = view.target.map((value, i) => value + (forward[i]! * move.forward + right[i]! * move.right + (i === 1 ? move.up : 0)) * step) as Vector;
  return { ...view, target };
}

/** The point of `ray` (from the camera) at `depth` ahead of it, along where it looks: under the pointer, that deep. */
export function pointOnRay(view: OrbitView, ray: Ray, depth: number): Vector {
  const forward = forwardOf(view);
  const along = ray.direction.reduce((sum, value, i) => sum + value * forward[i]!, 0);
  return ray.origin.map((value, i) => value + ray.direction[i]! * (depth / Math.max(along, 1e-6))) as Vector;
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

/** Where the camera looks, as a unit vector: from it towards the target. */
function forwardOf(view: OrbitView): Vector {
  const { yaw, pitch } = view;
  return [-Math.cos(pitch) * Math.sin(yaw), -Math.sin(pitch), -Math.cos(pitch) * Math.cos(yaw)];
}

/** The camera's right and up, as unit vectors in the viewer's space. */
function axesOf(view: OrbitView): { right: Vector; up: Vector } {
  const { yaw, pitch } = view;
  const right: Vector = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const up: Vector = [-Math.sin(pitch) * Math.sin(yaw), Math.cos(pitch), -Math.sin(pitch) * Math.cos(yaw)];
  return { right, up };
}

export function centreOf(bounds: BoundsLike): Vector {
  return bounds.min.map((value, i) => (value + bounds.max[i]!) / 2) as Vector;
}

function radiusOf(bounds: BoundsLike): number {
  return Math.hypot(...bounds.max.map((value, i) => value - bounds.min[i]!)) / 2;
}
