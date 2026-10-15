// A mesh's triangles as sets, fingerprinted: whatever order the file lists them in and whichever corner each starts
// from, as a re-export writes them in another order and Unity's import reorders them for the GPU anyway, so an order
// alone changed nothing. Three sets tell what did change over the same vertices: the triangles turning their way
// (`winding`), the vertices each joins whichever way it turns (`corners`: equal when only some faces flipped), and
// each triangle with its material slot (`slots`: faces painted with another material). Linear in the triangles and
// without allocating: each triangle is hashed on its own and the hashes summed, which no order changes.

import type { MeshGroup } from './parsedModel';

export interface TriangleSets {
  winding: string;
  corners: string;
  slots: string;
}

/**
 * `index`: the mesh's, or null when every three vertices of `vertexCount` make a triangle. `groups`: the ranges each
 * slot draws (a mesh without any draws all of it with its one slot).
 */
export function triangleSetsOf(index: Uint32Array | null, vertexCount: number, groups: readonly MeshGroup[]): TriangleSets {
  const length = index ? index.length : vertexCount;
  const corner = (i: number): number => (index ? index[i]! : i);
  const winding = new SetHash();
  const corners = new SetHash();
  for (let i = 0; i + 2 < length; i += 3) {
    winding.addTriangle(corner(i), corner(i + 1), corner(i + 2), 0);
    corners.addCorners(corner(i), corner(i + 1), corner(i + 2));
  }
  const slots = new SetHash();
  const ranges = groups.length > 0 ? groups : [{ start: 0, count: length, slot: 0 }];
  for (const { start, count, slot } of ranges) {
    for (let i = start; i + 2 < Math.min(start + count, length); i += 3) {
      slots.addTriangle(corner(i), corner(i + 1), corner(i + 2), slot + 1);
    }
  }
  return { winding: winding.fingerprint(), corners: corners.fingerprint(), slots: slots.fingerprint() };
}

/** A multiset of four-number items, hashed: two independent 32-bit hashes per item, summed, and the count. */
class SetHash {
  private count = 0;
  private first = 0;
  private second = 0;

  /** A triangle started from its lowest vertex, turning the same way: (5, 1, 3) is (1, 3, 5); `tag` goes with it. */
  addTriangle(a: number, b: number, c: number, tag: number): void {
    if (a <= b && a <= c) this.add(a, b, c, tag);
    else if (b <= c) this.add(b, c, a, tag);
    else this.add(c, a, b, tag);
  }

  /** Only which vertices a triangle joins, whichever way it turns: (1, 5, 3) is (1, 3, 5). */
  addCorners(a: number, b: number, c: number): void {
    const low = Math.min(a, b, c);
    const high = Math.max(a, b, c);
    this.add(low, a + b + c - low - high, high, 0);
  }

  private add(a: number, b: number, c: number, d: number): void {
    this.count++;
    this.first = (this.first + mix(0x9e3779b9, a, b, c, d)) >>> 0;
    this.second = (this.second + mix(0x85ebca6b, a, b, c, d)) >>> 0;
  }

  fingerprint(): string {
    return `${this.count}:${hex(this.first)}${hex(this.second)}`;
  }
}

function mix(seed: number, a: number, b: number, c: number, d: number): number {
  let hash = step(step(step(step(seed, a), b), c), d);
  hash ^= hash >>> 16;
  return Math.imul(hash, 0x85ebca6b) >>> 0;
}

function step(hash: number, value: number): number {
  const mixed = Math.imul(hash ^ value, 0xcc9e2d51);
  return Math.imul(mixed ^ (mixed >>> 15), 0x1b873593);
}

function hex(value: number): string {
  return value.toString(16).padStart(8, '0');
}
