import { linkCurve, type Curve, type Point } from './curves';

/** A line drawn as cubic Béziers joined end to start. */
export type LinkPath = readonly Curve[];

/**
 * A link routes through the strip between rows once it reaches this many times farther across than up or down. Below
 * it, the S-curve is steep enough to cross the bands it passes; above it, the curve would leave its source flat and
 * arrive flat, running along both bands, its arrow pointing against the band's own parent arrows.
 */
export const SHALLOW_RATIO = 2.5;

/** How many times wider than tall each ramp between a changeset and the run is: a slant, never a right angle. */
const RAMP_WIDTH = 1.6;

/**
 * Where the run sits, from the destination's row: in the free strip between rows, under the captions of the row
 * above (`RUN_ABOVE`) or under the destination's own captions (`RUN_BELOW`), clear of both rows' bands.
 */
export const RUN_ABOVE = 68;
export const RUN_BELOW = 50;

/** What a ramp's control points take of it: 60% along its diagonal at the changeset, 45% flat at the run. */
const RAMP_DIAGONAL = 0.6;
const RAMP_FLAT = 0.45;

/**
 * The path a merge link takes from its source changeset to its destination. A steep link is the S-curve
 * (`linkCurve`). A shallow one leaves its source on a slant, runs flat along the strip beside the destination's row,
 * on the source's side, and comes down (or up) onto the destination on a slant: it crosses bands only across them,
 * never along them. Right angles stay the branch starts' shape, so a merge never reads as one.
 */
export function mergeLinkPath(from: Point, to: Point): LinkPath {
  const across = Math.abs(to.x - from.x);
  const upOrDown = Math.abs(to.y - from.y);
  return upOrDown === 0 || across > SHALLOW_RATIO * upOrDown ? routedPath(from, to) : [linkCurve(from, to)];
}

/** Every point that bounds the path: the box of the control points holds the whole line. */
export function pathPoints(path: LinkPath): Point[] {
  return path.flat();
}

/** Where a routed link runs: beside the destination's row, on the source's side; level rows go through the strip above. */
export function runY(from: Point, to: Point): number {
  return from.y > to.y ? to.y + RUN_BELOW : to.y - RUN_ABOVE;
}

function routedPath(from: Point, to: Point): LinkPath {
  const run = runY(from, to);
  const direction = Math.sign(to.x - from.x) || 1;
  // Each ramp is as wide as its slant needs, never more than half the link: a short link is two ramps and no run.
  const half = Math.abs(to.x - from.x) / 2;
  const runStart = { x: from.x + direction * Math.min(Math.abs(run - from.y) * RAMP_WIDTH, half), y: run };
  const runEnd = { x: to.x - direction * Math.min(Math.abs(to.y - run) * RAMP_WIDTH, half), y: run };
  const path: Curve[] = [leavingRamp(from, runStart)];
  if (Math.abs(runEnd.x - runStart.x) > 1) path.push(straight(runStart, runEnd));
  path.push(arrivingRamp(runEnd, to));
  return path;
}

/** From a changeset on a 45° slant, easing flat into the run. */
function leavingRamp(changeset: Point, runStart: Point): Curve {
  const dx = runStart.x - changeset.x;
  const dy = runStart.y - changeset.y;
  const diagonal = Math.min(Math.abs(dx), Math.abs(dy)) * RAMP_DIAGONAL;
  return [
    changeset,
    { x: changeset.x + Math.sign(dx) * diagonal, y: changeset.y + Math.sign(dy) * diagonal },
    { x: runStart.x - dx * RAMP_FLAT, y: runStart.y },
    runStart,
  ];
}

/** Out of the run, easing into a 45° slant onto the changeset: the arrow lands across the band. */
function arrivingRamp(runEnd: Point, changeset: Point): Curve {
  const dx = changeset.x - runEnd.x;
  const dy = changeset.y - runEnd.y;
  const diagonal = Math.min(Math.abs(dx), Math.abs(dy)) * RAMP_DIAGONAL;
  return [
    runEnd,
    { x: runEnd.x + dx * RAMP_FLAT, y: runEnd.y },
    { x: changeset.x - Math.sign(dx) * diagonal, y: changeset.y - Math.sign(dy) * diagonal },
    changeset,
  ];
}

function straight(a: Point, b: Point): Curve {
  const at = (t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  return [a, at(1 / 3), at(2 / 3), b];
}
