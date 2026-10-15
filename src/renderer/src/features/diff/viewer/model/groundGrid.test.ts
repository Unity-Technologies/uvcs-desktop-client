import { describe, expect, it } from 'vitest';
import { FADE_DISTANCES, gridFadeDistanceOf } from './groundGrid';

describe('gridFadeDistanceOf', () => {
  it('reaches farther as the camera backs off, so zooming out shows more ground, never an edge', () => {
    expect(gridFadeDistanceOf(2)).toBe(2 * FADE_DISTANCES);
    expect(gridFadeDistanceOf(200)).toBe(200 * FADE_DISTANCES);
  });

  it('keeps a distance for a camera at its target', () => {
    expect(gridFadeDistanceOf(0)).toBeGreaterThan(0);
  });
});
