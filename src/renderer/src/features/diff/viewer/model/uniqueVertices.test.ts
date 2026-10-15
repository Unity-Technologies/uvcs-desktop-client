import { describe, expect, it } from 'vitest';
import { countUniqueVertices, fingerprintOf } from './uniqueVertices';

describe('countUniqueVertices', () => {
  it('counts each distinct tuple once, however many corners share it', () => {
    // 10,000 distinct positions, each stored three times: their hashes cover the whole 32-bit range, top bit too.
    const positions = new Float32Array(30000 * 3);
    for (let i = 0; i < 30000; i++) positions.set([i % 10000, (i % 10000) * 0.5, -(i % 10000)], i * 3);
    expect(countUniqueVertices({ arrays: [positions], sizes: [3], count: 30000 })).toBe(10000);
  });

  it('keeps apart corners that share a position but not another attribute', () => {
    const positions = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const uvs = new Float32Array([0, 0, 1, 0, 0, 0]);
    expect(countUniqueVertices({ arrays: [positions, uvs], sizes: [3, 2], count: 3 })).toBe(2);
  });

  it('welds values that differ by less than their step', () => {
    const positions = new Float32Array([0, 0, 0, 0, 0, 0]);
    const normals = new Float32Array([0, 1, 0, 0.00001, 0.99999, 0]);
    expect(countUniqueVertices({ arrays: [positions, normals], sizes: [3, 3], count: 2 })).toBe(2);
    expect(countUniqueVertices({ arrays: [positions, normals], sizes: [3, 3], steps: [0, 1e-4], count: 2 })).toBe(1);
  });

  it('takes -0 and 0 as one value', () => {
    expect(countUniqueVertices({ arrays: [new Float32Array([0, -0, 0, -0, 0, 0])], sizes: [3], count: 2 })).toBe(1);
  });

  it('is 0 for no vertices', () => {
    expect(countUniqueVertices({ arrays: [new Float32Array()], sizes: [3], count: 0 })).toBe(0);
  });
});

describe('fingerprintOf', () => {
  it('tells arrays apart by every value and by length', () => {
    expect(fingerprintOf(new Float32Array([1, 2, 3]))).toBe(fingerprintOf(new Float32Array([1, 2, 3])));
    expect(fingerprintOf(new Float32Array([1, 2, 3]))).not.toBe(fingerprintOf(new Float32Array([1, 2, 3.0001])));
    expect(fingerprintOf(new Float32Array([0]))).not.toBe(fingerprintOf(new Float32Array([0, 0])));
    expect(fingerprintOf(null)).toBe('');
  });

  it("fingerprints bytes where they are, a view into another buffer as its copy, and tells a byte's change", () => {
    const file = new Uint8Array([9, 1, 2, 3, 4, 5]);
    const image = file.subarray(1);
    expect(fingerprintOf(image)).toBe(fingerprintOf(image.slice()));
    expect(fingerprintOf(image)).not.toBe(fingerprintOf(new Uint8Array([1, 2, 3, 4, 6])));
  });
});
