import { describe, expect, it } from 'vitest';
import { closestOnTriangle, surfaceDistances } from './surfaceDistance';

/** A unit square on the XZ plane at height `y`, as two triangles, or as `n`×`n` cells of two triangles each. */
function square(y = 0, n = 1): Float32Array {
  const triangles: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const [x0, x1, z0, z1] = [i / n, (i + 1) / n, j / n, (j + 1) / n];
      triangles.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z0, x1, y, z1, x0, y, z1);
    }
  }
  return new Float32Array(triangles);
}

const points = (...values: [number, number, number][]): Float32Array => new Float32Array(values.flat());

describe('closestOnTriangle', () => {
  const triangle = [0, 0, 0, 1, 0, 0, 0, 1, 0];
  const closest = (p: [number, number, number]): number[] => {
    const out = new Float64Array(3);
    closestOnTriangle(triangle, 0, ...p, out);
    return [...out].map((value) => Number(value.toFixed(6)) + 0);
  };

  it('projects a point over the face onto it', () => {
    expect(closest([0.2, 0.2, 5])).toEqual([0.2, 0.2, 0]);
  });

  it('measures a degenerate triangle (its corners in a line) by its corners and edges, never as no number', () => {
    const line = [0, 0, 0, 1, 0, 0, 2, 0, 0];
    const out = new Float64Array(3);
    closestOnTriangle(line, 0, 1, 1, 0, out);
    expect(out.every(Number.isFinite)).toBe(true);
    expect(Math.hypot(out[0]! - 1, out[1]! - 1, out[2]!)).toBeCloseTo(1);
    // Two corners at one point: the edge between them has no length to divide by.
    closestOnTriangle([0, 0, 0, 0, 0, 0, 1, 0, 0], 0, 0.5, 1, 0, out);
    expect([...out].map((value) => Number(value.toFixed(6)) + 0)).toEqual([0.5, 0, 0]);
  });

  it('takes the nearest corner or edge for a point outside the face', () => {
    expect(closest([-1, -1, 0])).toEqual([0, 0, 0]);
    expect(closest([0.5, -1, 0])).toEqual([0.5, 0, 0]);
    expect(closest([1, 1, 0])).toEqual([0.5, 0.5, 0]);
  });
});

describe('surfaceDistances', () => {
  it('measures how far each vertex is from the surface', () => {
    const distances = surfaceDistances(points([0.5, 0.25, 0.5], [0.5, 0, 0.5], [2, 0, 0.5]), { positions: square() }, { maxDistance: 10 });
    expect([...distances].map((value) => Number(value.toFixed(5)))).toEqual([0.25, 0, 1]);
  });

  it('measures a re-meshed surface that kept its shape as unchanged', () => {
    const vertices = square(0, 7);
    const distances = surfaceDistances(vertices, { positions: square(0, 3) }, { maxDistance: 1 });
    expect(Math.max(...distances)).toBeLessThan(1e-6);
  });

  it('tells a vertex with nothing near as far as the most it measures', () => {
    expect([...surfaceDistances(points([0, 50, 0]), { positions: square() }, { maxDistance: 0.5 })]).toEqual([0.5]);
    expect([...surfaceDistances(points([0, 0, 0]), { positions: new Float32Array() }, { maxDistance: 0.5 })]).toEqual([0.5]);
  });

  it('finds the nearest triangle as measuring every one would, wherever the vertex is', () => {
    // A seeded generator, so the triangles and points are the same at every run.
    let seed = 7;
    const random = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const triangles = new Float32Array(Array.from({ length: 300 * 9 }, () => random() * 10));
    const vertices = new Float32Array(Array.from({ length: 200 * 3 }, () => random() * 14 - 2));
    const fast = surfaceDistances(vertices, { positions: triangles }, { maxDistance: 100 });
    const out = new Float64Array(3);
    for (let v = 0; v < 200; v++) {
      const [x, y, z] = [vertices[v * 3]!, vertices[v * 3 + 1]!, vertices[v * 3 + 2]!];
      let brute = Infinity;
      for (let t = 0; t < 300; t++) {
        closestOnTriangle(triangles, t, x, y, z, out);
        brute = Math.min(brute, Math.hypot(out[0]! - x, out[1]! - y, out[2]! - z));
      }
      expect(fast[v]).toBeCloseTo(brute, 4);
    }
  });
});
