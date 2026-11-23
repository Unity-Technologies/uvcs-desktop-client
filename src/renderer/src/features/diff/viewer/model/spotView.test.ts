import { Matrix4 } from 'three';
import { describe, expect, it } from 'vitest';
import { roomBesideCard } from '../pins/pinPlacement';
import { projectorOf } from './modelProjection';
import { FIRST_PITCH, type OrbitView, type Vector } from './orbitCamera';
import { viewOfSpot } from './spotView';

const MODEL = { min: [-1, 0, -1] as Vector, max: [1, 2, 1] as Vector };
const FRONT: OrbitView = { target: [0, 1, 0], yaw: 0, pitch: FIRST_PITCH, distance: 8 };
/** A file in centimetres, Z up: its Z is the viewer's Y, its Y the viewer's -Z. */
const CENTIMETRES_Z_UP = new Matrix4().makeRotationX(-Math.PI / 2).multiply(new Matrix4().makeScale(0.01, 0.01, 0.01));
/** A wide pane, with room for a card beside a point, and a narrow one, with room for it only below. */
const WIDE = { width: 1200, height: 700 };
const NARROW = { width: 600, height: 700 };

/** Where `point` shows in a pane of `size` from `view`, in CSS pixels. */
function onScreen(view: OrbitView, point: Vector, size: { width: number; height: number }): { x: number; y: number } {
  const at = projectorOf(view, MODEL, { x: 0, y: 0, ...size }, { ...size, pixelRatio: 1 })(point)!;
  return { x: Math.round(at.x), y: Math.round(at.y) };
}

/** The middle of the room a card beside a point leaves in a pane of `size`. */
function roomCentre(size: { width: number; height: number }): { x: number; y: number } {
  const room = roomBesideCard(size);
  return { x: Math.round(room.x + room.width / 2), y: Math.round(room.y + room.height / 2) };
}

describe('viewOfSpot', () => {
  it('looks from where its author looked, carried into the viewer’s units and axes', () => {
    // 300 cm above the point, in the file's Z: 3 m above it in the viewer's Y.
    const view = viewOfSpot([0.5, 1, 0], { direction: { x: 0, y: 0, z: 1 }, distance: 300 }, CENTIMETRES_Z_UP, FRONT, MODEL, WIDE);
    expect(view.distance).toBeCloseTo(3);
    expect(view.pitch).toBeCloseTo((89 * Math.PI) / 180);
  });

  it('turns to the side the author looked from', () => {
    // From the file's +X: the viewer's +X, a quarter turn from the front.
    const view = viewOfSpot([0, 1, 0], { direction: { x: 1, y: 0, z: 0 }, distance: 200 }, CENTIMETRES_Z_UP, FRONT, MODEL, WIDE);
    expect(view.yaw).toBeCloseTo(Math.PI / 2);
    expect(view.pitch).toBeCloseTo(0);
    expect(view.distance).toBeCloseTo(2);
  });

  it("faces a point from the side its surface faces when the comment doesn't say where its author looked", () => {
    // On the model's back, turned away from the front camera: it turns round to face it.
    const view = viewOfSpot([0, 1, -1], undefined, CENTIMETRES_Z_UP, FRONT, MODEL, WIDE);
    expect(Math.abs(view.yaw)).toBeCloseTo(Math.PI);
  });

  it('stands back far enough to show a good part of the model around the point, not a close-up of its surface', () => {
    const view = viewOfSpot([0, 2, 0], undefined, CENTIMETRES_Z_UP, FRONT, MODEL, WIDE);
    // The model is 3.5 m across: a third of it in view, at least.
    expect(view.distance).toBeGreaterThan(1.5);
  });

  it('shows the point beside the room its card takes, not under the card: on the left of a wide pane', () => {
    const point: Vector = [0.5, 1, 0];
    const written = viewOfSpot(point, { direction: { x: 0, y: -1, z: 0 }, distance: 300 }, CENTIMETRES_Z_UP, FRONT, MODEL, WIDE);
    const faced = viewOfSpot(point, undefined, CENTIMETRES_Z_UP, FRONT, MODEL, WIDE);
    expect(onScreen(written, point, WIDE)).toEqual(roomCentre(WIDE));
    expect(onScreen(faced, point, WIDE)).toEqual(roomCentre(WIDE));
    expect(roomCentre(WIDE).x).toBeLessThan(WIDE.width / 2);
  });

  it('shows the point above the room its card takes in a pane too narrow for it beside the point', () => {
    const point: Vector = [0.5, 1, 0];
    const view = viewOfSpot(point, undefined, CENTIMETRES_Z_UP, FRONT, MODEL, NARROW);
    expect(onScreen(view, point, NARROW)).toEqual(roomCentre(NARROW));
    expect(roomCentre(NARROW).y).toBeLessThan(NARROW.height / 2);
  });

  it('frames the model around the point within that room, so the card covers none of it', () => {
    const point: Vector = [0.5, 1, 0];
    const view = viewOfSpot(point, undefined, CENTIMETRES_Z_UP, FRONT, MODEL, NARROW);
    const room = roomBesideCard(NARROW);
    // The region framed: a good part of the model, 30 % of its 3.46 m diagonal, around the point.
    const half = (Math.hypot(2, 2, 2) * 0.3) / 2;
    const corners = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [point[0] + x * half, point[1] + y * half, point[2] + z * half] as Vector)));
    for (const corner of corners) {
      const at = onScreen(view, corner, NARROW);
      expect(at.x).toBeGreaterThanOrEqual(room.x);
      expect(at.x).toBeLessThanOrEqual(room.x + room.width);
      expect(at.y).toBeGreaterThanOrEqual(room.y);
      expect(at.y).toBeLessThanOrEqual(room.y + room.height);
    }
  });
});
