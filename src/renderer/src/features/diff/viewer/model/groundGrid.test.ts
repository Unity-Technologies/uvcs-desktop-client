import { describe, expect, it } from 'vitest';
import { gridFadeDistanceOf } from './groundGrid';

describe('gridFadeDistanceOf', () => {
  it('fades the grid out five times as far as the camera stands from what it looks at', () => {
    expect(gridFadeDistanceOf(2)).toBe(10);
  });

  it('reaches farther as the camera backs off, so zooming out shows more ground, never an edge', () => {
    expect(gridFadeDistanceOf(200)).toBeGreaterThan(gridFadeDistanceOf(2) * 50);
  });

  it('keeps a distance for a camera at its target', () => {
    expect(gridFadeDistanceOf(0)).toBeGreaterThan(0);
  });
});
