// How far each vertex of one surface is from another surface: the Differences mode's measure, the 3D twin of the
// image diff's pixel difference. Each triangle is measured exactly (closest point on a triangle, Ericson, Real-Time
// Collision Detection 5.1.5), so a re-meshed surface that kept its shape measures 0, which a nearest-vertex distance
// would not. Two things keep it fast on a real model, whose triangles crowd where the detail is:
//
// - A vertex found exactly at a vertex of the other surface (to `SAME_POINT_STEP`) is at 0 without a search: most of a
//   model is unchanged between versions. And each point is measured once: a file repeats a corner per polygon.
// - The other surface's triangles go in a bounding volume hierarchy (`buildHierarchy`), searched nearest box first,
//   skipping every box farther than the nearest triangle found. A uniform grid was tried first and dropped: a dense
//   fuselage beside an empty helipad put thousands of triangles in a cell (3.3 s for 38k vertices).
//
// Pure and allocation-light: it runs in the model worker over millions of vertices.

/** A triangle soup: `positions` holds 9 floats per triangle, in one space. */
export interface Triangles {
  positions: Float32Array;
}

/** Past this distance a vertex is told as far as this: it's "not there" in the other version, however far. */
export interface DistanceOptions {
  maxDistance: number;
}

/** Points this close are one: below a re-export's rounding, far below what the Differences mode can show. */
const SAME_POINT_STEP = 1e-6;

/**
 * A surface made ready to measure against: its corners hashed and its triangles in a hierarchy. Building it reads every
 * triangle, so a version's surface is built once and measured against for all the other version's meshes.
 */
export class MeasurableSurface {
  private constructor(
    readonly corners: PointSet,
    /** Null for a surface without triangles: nothing is near it. */
    readonly search: NearestSearch | null,
  ) {}

  static of({ positions }: Triangles): MeasurableSurface {
    const triangleCount = positions.length / 9;
    const search = triangleCount === 0 ? null : new NearestSearch(buildHierarchy(positions, triangleCount), positions);
    return new MeasurableSurface(new PointSet(positions), search);
  }
}

export function surfaceDistances(vertices: Float32Array, surface: MeasurableSurface, { maxDistance }: DistanceOptions): Float32Array {
  const distances = new Float32Array(vertices.length / 3).fill(maxDistance);
  const { corners, search } = surface;
  if (!search) return distances;
  const measured = new PointSet(vertices);
  const measures = new Float32Array(measured.size).fill(-1);
  for (let v = 0; v < distances.length; v++) {
    const x = vertices[v * 3]!;
    const y = vertices[v * 3 + 1]!;
    const z = vertices[v * 3 + 2]!;
    const point = measured.indexOf(x, y, z);
    if (measures[point]! < 0) measures[point] = corners.indexOf(x, y, z) !== -1 ? 0 : Math.min(maxDistance, search.distance(x, y, z, maxDistance));
    distances[v] = measures[point]!;
  }
  return distances;
}

/**
 * The distinct points of a list, hashed to `SAME_POINT_STEP` in an open-addressed table (as `countUniqueVertices`
 * does), each numbered in the order first seen.
 */
class PointSet {
  private readonly keys: Int32Array;
  private readonly indices: Int32Array;
  private readonly mask: number;
  size = 0;

  constructor(positions: Float32Array) {
    const count = positions.length / 3;
    const capacity = 2 ** Math.ceil(Math.log2(Math.max(2, count * 2)));
    this.mask = capacity - 1;
    // Three steps per point; a slot is empty while its first is EMPTY.
    this.keys = new Int32Array(capacity * 3).fill(EMPTY);
    this.indices = new Int32Array(capacity);
    for (let i = 0; i < count; i++) this.add(positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!);
  }

  /** The point's number, or -1 when it isn't one of the set's. */
  indexOf(x: number, y: number, z: number): number {
    const slot = this.slotOf(step(x), step(y), step(z));
    return this.keys[slot * 3] === EMPTY ? -1 : this.indices[slot]!;
  }

  private add(x: number, y: number, z: number): void {
    const [a, b, c] = [step(x), step(y), step(z)];
    const slot = this.slotOf(a, b, c);
    if (this.keys[slot * 3] !== EMPTY) return;
    this.keys.set([a, b, c], slot * 3);
    this.indices[slot] = this.size++;
  }

  /** The point's slot, or the empty one it would go in. */
  private slotOf(a: number, b: number, c: number): number {
    let slot = hash(a, b, c) & this.mask;
    while (this.keys[slot * 3] !== EMPTY && !(this.keys[slot * 3] === a && this.keys[slot * 3 + 1] === b && this.keys[slot * 3 + 2] === c)) slot = (slot + 1) & this.mask;
    return slot;
  }
}

const EMPTY = -2147483648;

/** A coordinate in whole steps, as an int32 (a model past 2 km from its origin wraps, and only loses the shortcut). */
function step(value: number): number {
  const steps = Math.round(value / SAME_POINT_STEP) | 0;
  return steps === EMPTY ? EMPTY + 1 : steps;
}

function hash(a: number, b: number, c: number): number {
  return (Math.imul(a, 0x9e3779b1) ^ Math.imul(b, 0x85ebca77) ^ Math.imul(c, 0xc2b2ae3d)) >>> 0;
}

/** Triangles per leaf: few enough to measure them all, enough to keep the hierarchy shallow. */
const LEAF_SIZE = 4;

/**
 * Nodes in flat arrays: node `n`'s box is `boxes[n * 6 ..]` (min x y z, max x y z); a leaf holds triangles
 * `order[first[n] .. first[n] + count[n]]`, an inner node (count 0) its children at `first[n]` and `first[n] + 1`.
 */
interface Hierarchy {
  boxes: Float32Array;
  first: Uint32Array;
  count: Uint32Array;
  order: Uint32Array;
}

/** Splits each node at the median of its triangles' centres along its box's longest axis. */
function buildHierarchy(positions: Float32Array, triangleCount: number): Hierarchy {
  const centres = new Float32Array(triangleCount * 3);
  for (let t = 0; t < triangleCount; t++) {
    for (let axis = 0; axis < 3; axis++) centres[t * 3 + axis] = (positions[t * 9 + axis]! + positions[t * 9 + 3 + axis]! + positions[t * 9 + 6 + axis]!) / 3;
  }
  const order = new Uint32Array(triangleCount).map((_, i) => i);
  // Every leaf holds a triangle at least: never more than 2n - 1 nodes.
  const maxNodes = 2 * triangleCount + 1;
  const boxes = new Float32Array(maxNodes * 6);
  const first = new Uint32Array(maxNodes);
  const count = new Uint32Array(maxNodes);
  let nodes = 1;
  const pending: [number, number, number][] = [[0, 0, triangleCount]];
  while (pending.length > 0) {
    const [node, start, end] = pending.pop()!;
    boundTriangles(positions, order, start, end, boxes, node);
    if (end - start <= LEAF_SIZE) {
      first[node] = start;
      count[node] = end - start;
      continue;
    }
    const sizes = [0, 1, 2].map((axis) => boxes[node * 6 + 3 + axis]! - boxes[node * 6 + axis]!);
    const axis = sizes.indexOf(Math.max(...sizes));
    const middle = (start + end) >> 1;
    selectNth(order, centres, axis, start, end, middle);
    const left = nodes;
    nodes += 2;
    first[node] = left;
    count[node] = 0;
    pending.push([left, start, middle], [left + 1, middle, end]);
  }
  return { boxes, first, count, order };
}

function boundTriangles(positions: Float32Array, order: Uint32Array, start: number, end: number, boxes: Float32Array, node: number): void {
  const o = node * 6;
  boxes.set([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], o);
  for (let i = start; i < end; i++) {
    const t = order[i]! * 9;
    for (let corner = 0; corner < 9; corner += 3) {
      for (let axis = 0; axis < 3; axis++) {
        const value = positions[t + corner + axis]!;
        if (value < boxes[o + axis]!) boxes[o + axis] = value;
        if (value > boxes[o + 3 + axis]!) boxes[o + 3 + axis] = value;
      }
    }
  }
}

/** Puts the `nth` smallest centre (along `axis`) of `order[start..end]` at `nth`, smaller before it (quickselect). */
function selectNth(order: Uint32Array, centres: Float32Array, axis: number, start: number, end: number, nth: number): void {
  let lo = start;
  let hi = end - 1;
  while (lo < hi) {
    const pivot = centres[order[(lo + hi) >> 1]! * 3 + axis]!;
    let i = lo;
    let j = hi;
    while (i <= j) {
      while (centres[order[i]! * 3 + axis]! < pivot) i++;
      while (centres[order[j]! * 3 + axis]! > pivot) j--;
      if (i <= j) {
        const swap = order[i]!;
        order[i] = order[j]!;
        order[j] = swap;
        i++;
        j--;
      }
    }
    if (nth <= j) hi = j;
    else if (nth >= i) lo = i;
    else return;
  }
}

/** One search at a time over a hierarchy, reusing its stack and its closest point. */
class NearestSearch {
  private readonly stack: Uint32Array;
  private readonly closest = new Float64Array(3);

  constructor(
    private readonly hierarchy: Hierarchy,
    private readonly positions: Float32Array,
  ) {
    this.stack = new Uint32Array(hierarchy.first.length);
  }

  distance(x: number, y: number, z: number, maxDistance: number): number {
    const { boxes, first, count, order } = this.hierarchy;
    let best = maxDistance * maxDistance;
    let top = 0;
    this.stack[top++] = 0;
    while (top > 0) {
      const node = this.stack[--top]!;
      if (boxDistanceSquared(boxes, node, x, y, z) >= best) continue;
      if (count[node]! > 0) {
        for (let i = first[node]!; i < first[node]! + count[node]!; i++) {
          closestOnTriangle(this.positions, order[i]!, x, y, z, this.closest);
          const dx = this.closest[0]! - x;
          const dy = this.closest[1]! - y;
          const dz = this.closest[2]! - z;
          best = Math.min(best, dx * dx + dy * dy + dz * dz);
        }
        if (best === 0) break;
        continue;
      }
      // The nearer child last, so it is searched first and prunes the other.
      const left = first[node]!;
      const right = left + 1;
      const near = boxDistanceSquared(boxes, left, x, y, z) <= boxDistanceSquared(boxes, right, x, y, z);
      this.stack[top++] = near ? right : left;
      this.stack[top++] = near ? left : right;
    }
    return Math.sqrt(best);
  }
}

function boxDistanceSquared(boxes: Float32Array, node: number, x: number, y: number, z: number): number {
  const o = node * 6;
  const dx = Math.max(boxes[o]! - x, 0, x - boxes[o + 3]!);
  const dy = Math.max(boxes[o + 1]! - y, 0, y - boxes[o + 4]!);
  const dz = Math.max(boxes[o + 2]! - z, 0, z - boxes[o + 5]!);
  return dx * dx + dy * dy + dz * dz;
}

/** The point of triangle `t` closest to p, into `out`: by the Voronoi region of the triangle p falls in. */
export function closestOnTriangle(positions: ArrayLike<number>, t: number, px: number, py: number, pz: number, out: Float64Array): void {
  const o = t * 9;
  const ax = positions[o]!, ay = positions[o + 1]!, az = positions[o + 2]!;
  const bx = positions[o + 3]!, by = positions[o + 4]!, bz = positions[o + 5]!;
  const cx = positions[o + 6]!, cy = positions[o + 7]!, cz = positions[o + 8]!;
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const acx = cx - ax, acy = cy - ay, acz = cz - az;
  // A triangle with no area (two corners at one point, or all three in a line) has no Voronoi regions to tell
  // apart: its nearest point is its nearest edge's.
  const nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
  if (nx * nx + ny * ny + nz * nz === 0) return closestOnEdges(ax, ay, az, bx, by, bz, cx, cy, cz, px, py, pz, out);
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  const set = (x: number, y: number, z: number): void => {
    out[0] = x;
    out[1] = y;
    out[2] = z;
  };
  if (d1 <= 0 && d2 <= 0) return set(ax, ay, az);
  const bpx = px - bx, bpy = py - by, bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return set(bx, by, bz);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return set(ax + v * abx, ay + v * aby, az + v * abz);
  }
  const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) return set(cx, cy, cz);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return set(ax + w * acx, ay + w * acy, az + w * acz);
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return set(bx + w * (cx - bx), by + w * (cy - by), bz + w * (cz - bz));
  }
  // Inside the face: its projection.
  const denominator = 1 / (va + vb + vc);
  const v = vb * denominator;
  const w = vc * denominator;
  return set(ax + abx * v + acx * w, ay + aby * v + acy * w, az + abz * v + acz * w);
}

function closestOnEdges(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, px: number, py: number, pz: number, out: Float64Array): void {
  let best = Infinity;
  const edges = [
    [ax, ay, az, bx, by, bz],
    [bx, by, bz, cx, cy, cz],
    [cx, cy, cz, ax, ay, az],
  ] as const;
  for (const [x0, y0, z0, x1, y1, z1] of edges) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const length = dx * dx + dy * dy + dz * dz;
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy + (pz - z0) * dz) / length));
    const qx = x0 + t * dx, qy = y0 + t * dy, qz = z0 + t * dz;
    const distance = (qx - px) ** 2 + (qy - py) ** 2 + (qz - pz) ** 2;
    if (distance < best) {
      best = distance;
      out[0] = qx;
      out[1] = qy;
      out[2] = qz;
    }
  }
}
