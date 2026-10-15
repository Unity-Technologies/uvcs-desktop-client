import { describe, expect, it } from 'vitest';
import { pickedAt, pickWindowAt } from './pickWindow';

describe('pickWindowAt', () => {
  it("centres the window on the pane's centre when the pointer is there", () => {
    // A 400 × 300 CSS canvas at 2×: the after's half of Split is x 400-800 device pixels.
    const window = pickWindowAt(300, 150, { x: 400, y: 0, width: 400, height: 600 }, 300, 2);
    expect(window).toEqual({ ndc: [0, 0], full: { width: 400, height: 600 }, offset: { x: 199.5, y: 299.5 } });
  });

  it('counts the window from the top left, as the view offset does, and the point up positive, as the ray does', () => {
    // Near the top left corner of a full canvas of 200 × 100 at 1×.
    const window = pickWindowAt(10, 5, { x: 0, y: 0, width: 200, height: 100 }, 100, 1);
    expect(window.ndc).toEqual([expect.closeTo(-0.9), expect.closeTo(0.9)]);
    expect(window.offset).toEqual({ x: 9.5, y: 4.5 });
  });
});

describe('pickedAt', () => {
  it('reads the mesh by its place plus one, and the point of its surface', () => {
    expect(pickedAt(new Float32Array([1.5, -2, 0.25, 3]))).toEqual({ mesh: 2, point: [1.5, -2, 0.25] });
  });

  it('reads nothing where nothing was drawn', () => {
    expect(pickedAt(new Float32Array(4))).toBeNull();
  });
});
