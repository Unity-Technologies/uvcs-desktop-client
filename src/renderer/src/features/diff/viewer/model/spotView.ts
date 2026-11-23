// Where the camera goes to show a comment on a model (docs/features/code-reviews.md "Comments on 3D models"): the
// view its author had when they wrote it, when the comment says (`ModelSpotView`), turned and moved with its part;
// else facing the point from the side its surface faces, with some of the model around it, as stepping to a changed
// region does (`regionView`). Either way the point ends in the middle of the room its card leaves (`roomBesideCard`):
// left of the card where the pane is wide, above it where it isn't, so the card opens beside it, never over it.

import { Matrix4, Vector3 } from 'three';
import type { ModelSpotView } from '@shared/domain/reviewConversation';
import type { Size } from '../image/composedFrame';
import { roomBesideCard, type ScreenRect } from '../pins/pinPlacement';
import { diagonalOf, MIN_DISTANCE, panned, type BoundsLike, type OrbitView, type Vector } from './orbitCamera';
import { regionView } from './regionView';

/** The region a point is framed as, as a share of the model: the point with a good part of the model around it, to place it by. */
const AROUND_POINT_SHARE = 0.3;
/** Short of straight up or down, as the hand's orbit stops (`orbited`): the camera never turns over. */
const MAX_PITCH = (89 * Math.PI) / 180;

/**
 * The view that shows a spot placed at `point` (the viewer's space) in a pane of `pane`'s size, the point in the room its
 * card leaves: from where its author looked (`written`, in the file's space, carried into the viewer's by
 * `viewerSpace`), or facing it (`regionView`), framed in that room, when the comment doesn't say. The camera orbits a
 * target that much beside the point.
 */
export function viewOfSpot(point: Vector, written: ModelSpotView | undefined, viewerSpace: Matrix4, current: OrbitView, model: BoundsLike, pane: Size): OrbitView {
  const room = roomBesideCard(pane);
  const view = written ? writtenView(point, written, viewerSpace) : facingView(point, current, model, room, pane);
  return shownIn(view, room, pane);
}

/** From where its author looked, at the point. */
function writtenView(point: Vector, written: ModelSpotView, viewerSpace: Matrix4): OrbitView {
  // From the point to the camera, in the viewer's space: its units in metres, its axes Unity's.
  const offset = new Vector3(written.direction.x, written.direction.y, written.direction.z).multiplyScalar(written.distance).applyMatrix4(linearOf(viewerSpace));
  const distance = Math.max(offset.length(), MIN_DISTANCE);
  const pitch = clamp(Math.asin(clamp(offset.y / distance, -1, 1)), -MAX_PITCH, MAX_PITCH);
  return { target: point, yaw: Math.atan2(offset.x, offset.z), pitch, distance };
}

/** Facing the point, with a good part of the model around it framed in `room`. */
function facingView(point: Vector, current: OrbitView, model: BoundsLike, room: ScreenRect, pane: Size): OrbitView {
  const half = (diagonalOf(model) * AROUND_POINT_SHARE) / 2;
  const region = { min: point.map((value) => value - half) as Vector, max: point.map((value) => value + half) as Vector };
  return regionView(region, model, current, room.width / room.height, room.height / pane.height);
}

/** The view moved sideways so that its target, the point, shows in the middle of `room` rather than of the pane. */
function shownIn(view: OrbitView, room: ScreenRect, pane: Size): OrbitView {
  return panned(view, room.x + room.width / 2 - pane.width / 2, room.y + room.height / 2 - pane.height / 2, pane.height);
}

/** The matrix without its translation: what it does to a direction and a length. */
function linearOf(matrix: Matrix4): Matrix4 {
  return matrix.clone().setPosition(0, 0, 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
