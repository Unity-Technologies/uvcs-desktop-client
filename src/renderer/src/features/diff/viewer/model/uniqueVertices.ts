// How many vertices Unity's mesh has once imported. A file stores a vertex per polygon corner (FBX) or per index
// (glTF); Unity welds the corners that share every attribute and keeps apart those that differ in any (a UV seam, a
// hard edge), so its count is the number of distinct attribute tuples, which is what the Inspector shows and what a
// vertex budget counts. Unity welds normals that differ by float noise (exporters write split normals with it), so
// normals are compared to `NORMAL_WELD_STEP`; its count still differs by a few percent, as it also splits vertices
// for the tangents it computes. Tuples are told apart by a 64-bit hash of their bits in an open-addressed table of typed
// arrays: a few million corners take a few megabytes and tens of milliseconds, where a `Set` of strings took seconds.

/** The attributes of each vertex: `arrays[k]` holds `sizes[k]` floats per vertex, compared to `steps[k]` (0: exactly). */
export interface VertexAttributes {
  arrays: Float32Array[];
  sizes: number[];
  steps?: number[];
  count: number;
}

/** How close two normals' components weld: closest to Unity's counts on real exports (Blender, Maya). */
export const NORMAL_WELD_STEP = 1e-4;

const EMPTY_SLOT = 0;

export function countUniqueVertices({ arrays, sizes, steps = [], count }: VertexAttributes): number {
  if (count === 0) return 0;
  const bits = arrays.map((array, k) => (steps[k] ? snapped(array, steps[k]) : new Uint32Array(array.buffer, array.byteOffset, array.length)));
  // A power of two at least twice the count keeps probes short.
  const capacity = 2 ** Math.ceil(Math.log2(count * 2));
  const mask = capacity - 1;
  const high = new Uint32Array(capacity);
  const low = new Uint32Array(capacity);
  let unique = 0;
  for (let vertex = 0; vertex < count; vertex++) {
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let k = 0; k < bits.length; k++) {
      const size = sizes[k]!;
      const values = bits[k]!;
      for (let component = 0; component < size; component++) {
        // -0 and 0 are one value to Unity.
        const value = values[vertex * size + component]! === 0x80000000 ? 0 : values[vertex * size + component]!;
        h1 = Math.imul(h1 ^ value, 0x01000193);
        h2 = Math.imul(h2 ^ value, 0x5bd1e995) ^ (h2 >>> 15);
      }
    }
    // Unsigned, as the table stores them; a zero high word marks an empty slot, so a tuple hashing to it takes 1.
    h1 = h1 >>> 0 || 1;
    h2 = h2 >>> 0;
    let slot = (h2 ^ (h1 >>> 7)) & mask;
    while (high[slot] !== EMPTY_SLOT && (high[slot] !== h1 || low[slot] !== h2)) slot = (slot + 1) & mask;
    if (high[slot] === EMPTY_SLOT) {
      high[slot] = h1;
      low[slot] = h2;
      unique++;
    }
  }
  return unique;
}

/** The values as whole steps, which compare as bits like any value. */
function snapped(array: Float32Array, step: number): Uint32Array {
  const steps = new Int32Array(array.length);
  for (let i = 0; i < array.length; i++) steps[i] = Math.round(array[i]! / step);
  return new Uint32Array(steps.buffer);
}

/** A fingerprint of a float array's exact bits: equal arrays have equal fingerprints, and any change changes it. */
export function fingerprintOf(array: ArrayLike<number> | null): string {
  if (!array) return '';
  const bits = array instanceof Float32Array || array instanceof Int32Array ? new Uint32Array(array.buffer, array.byteOffset, array.length) : Uint32Array.from(array);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < bits.length; i++) {
    h1 = Math.imul(h1 ^ bits[i]!, 0x01000193);
    h2 = Math.imul(h2 ^ bits[i]!, 0x5bd1e995) ^ (h2 >>> 15);
  }
  return `${bits.length}:${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`;
}
