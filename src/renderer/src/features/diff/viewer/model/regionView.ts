// Where the camera goes when ‹ › step to a changed region (the Differences mode's `changedRegions`): onto the region,
// close enough for it to fill a good part of the view with some of the model around it, and turned to face it when it
// isn't facing the camera already. A region's changed surface faces outwards, so the side to look from is the one from
// the model's centre out through the region. Framing each region from the angle the camera had (Unity's F) was what
// stepping did first: two regions on either side of a model looked alike, and one turned away stayed out of sight.

import { cameraSideOf, centreOf, diagonalOf, FIRST_PITCH, framedView, type BoundsLike, type OrbitView, type Vector } from './orbitCamera';

/** Room around the region, as a share of its own radius: it fills about half the view, with its surroundings. */
const CONTEXT_SHARE = 0.35;
/** At least this share of the model around it: a tiny dent alone would fill the view with nothing to place it by. */
const MIN_CONTEXT_SHARE = 0.03;
/** A region facing the camera within this angle is in sight already: the user's angle stays. */
const IN_SIGHT_ANGLE = (60 * Math.PI) / 180;
/** Looking down onto a region on top at most this steeply: never over the top. */
const STEEPEST_PITCH = (50 * Math.PI) / 180;
/**
 * A region facing further down than this (feet, a hull's underside) is looked at level; one less steep, from the first
 * look's elevation. Looking up at it from below put the camera under the ground a model stands on, the grid between.
 */
const UNDERSIDE_ELEVATION = -STEEPEST_PITCH;
/** A region nearer the model's centre than this share of the model faces no side more than another. */
const HEART_SHARE = 0.05;
/** A direction this close to straight up or down has no side round the model to face: the camera keeps its own. */
const UPRIGHT_HORIZONTAL = 0.2;

/** The view stepping to `region` goes to, from `current`, for a pane of `aspect` (width over height). */
export function regionView(region: BoundsLike, model: BoundsLike, current: OrbitView, aspect: number): OrbitView {
  const modelSize = diagonalOf(model);
  const radius = diagonalOf(region) / 2;
  const pad = Math.max(radius * CONTEXT_SHARE, modelSize * MIN_CONTEXT_SHARE);
  const { yaw, pitch } = facingAngles(centreOf(region), centreOf(model), modelSize, current);
  return framedView(grown(region, pad), aspect, yaw, pitch);
}

/** The region as it is boxed on screen: just clear of its surface, a hundredth of the model around it. */
export function boxedRegion(region: BoundsLike, modelSize: number): BoundsLike {
  return grown(region, modelSize * 0.01);
}

/**
 * The camera's angles to see a region at `centre` from: the user's, while the region faces the camera; else from where
 * the region faces (the model's centre out through it), round the model and at a pleasant elevation.
 */
function facingAngles(centre: Vector, modelCentre: Vector, modelSize: number, current: OrbitView): { yaw: number; pitch: number } {
  const outward = centre.map((value, i) => value - modelCentre[i]!) as Vector;
  const length = Math.hypot(...outward);
  if (length < modelSize * HEART_SHARE) return current;
  const [x, y, z] = outward.map((value) => value / length) as Vector;
  const [sideX, sideY, sideZ] = cameraSideOf(current);
  const facing = sideX * x + sideY * y + sideZ * z;
  if (facing >= Math.cos(IN_SIGHT_ANGLE)) return current;
  const yaw = Math.hypot(x, z) < UPRIGHT_HORIZONTAL ? current.yaw : Math.atan2(x, z);
  return { yaw, pitch: pleasantPitch(Math.asin(y)) };
}

/** A region facing up is looked down onto, one facing down level, and one facing a side from a little above. */
function pleasantPitch(elevation: number): number {
  if (elevation >= FIRST_PITCH) return Math.min(elevation, STEEPEST_PITCH);
  if (elevation <= UNDERSIDE_ELEVATION) return 0;
  return FIRST_PITCH;
}

function grown(bounds: BoundsLike, pad: number): BoundsLike {
  return { min: bounds.min.map((value) => value - pad) as Vector, max: bounds.max.map((value) => value + pad) as Vector };
}
