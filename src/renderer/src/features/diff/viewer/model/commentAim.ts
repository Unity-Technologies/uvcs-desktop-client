// The ring that shows where a click will mark a point while commenting on a model: lying on the surface under the
// pointer, turned to it, so it reads on the face it will go on, and the same size on screen at any distance.

import { Quaternion, Vector3 } from 'three';
import type { Vector } from './orbitCamera';
import type { Layout } from './viewLayout';

/** The ring's size on screen, in CSS pixels across. */
export const AIM_RING_PIXELS = 14;

/** A point a click would mark, and the surface's direction there (towards the camera); none when it isn't known. */
export interface CommentAim {
  point: Vector;
  normal: Vector | null;
}

/** Where the ring is drawn: its centre, how it's turned, and its radius, in the viewer's space. */
export interface AimRingPlacement {
  position: Vector;
  quaternion: [number, number, number, number];
  radius: number;
}

/**
 * The ring at an aim, seen from `camera` with a vertical field of view of `fovDegrees` over a pane `paneHeight` device
 * pixels high, drawn `pixels` device pixels across. It lies on the surface (facing the camera where the surface's
 * direction isn't known), lifted off it by a hair of the distance so the surface doesn't cut through it.
 */
export function aimRingPlacement(aim: CommentAim, camera: Vector, fovDegrees: number, paneHeight: number, pixels: number): AimRingPlacement {
  const point = new Vector3(...aim.point);
  const toCamera = new Vector3(...camera).sub(point);
  const distance = toCamera.length();
  const facing = aim.normal ? new Vector3(...aim.normal).normalize() : toCamera.clone().normalize();
  const worldPerPixel = (2 * distance * Math.tan((fovDegrees * Math.PI) / 360)) / Math.max(paneHeight, 1);
  const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), facing);
  return {
    position: point.addScaledVector(facing, distance * LIFT_SHARE).toArray() as Vector,
    quaternion: quaternion.toArray() as [number, number, number, number],
    radius: (worldPerPixel * pixels) / 2,
  };
}

/** How far off the surface the ring sits, as a share of its distance from the camera. */
const LIFT_SHARE = 0.002;

/** When the ring is drawn: in its version's scene, or alone after every version is drawn. */
export type AimRingPass = 'withVersion' | 'afterComparison';

/**
 * When the ring is drawn, for every layout (`ModelRenderer.drawSide` asks it for each version drawn): with the version it
 * lies on, where the versions reach the canvas straight or blended; over Diffs by look once the versions are compared,
 * since drawn into a version it would compare as a change.
 */
export function aimRingPass(drawn: Layout['drawn']): AimRingPass {
  return drawn === 'compared' ? 'afterComparison' : 'withVersion';
}
