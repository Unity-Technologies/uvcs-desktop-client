import { describe, expect, it } from 'vitest';
import { changedLabel, colorHex, sideLabel } from './imageInfo';

describe('sideLabel', () => {
  it('shows dimensions and size', () => {
    expect(sideLabel({ width: 64, height: 32 }, 178)).toBe('64×32 · 178 B');
  });
});

describe('changedLabel', () => {
  it('reports the share of covered pixels that differ', () => {
    expect(changedLabel({ changedPixels: 484, coveredPixels: 1000 }, 0)).toBe('48.4% of pixels differ');
    expect(changedLabel({ changedPixels: 1, coveredPixels: 10_000 }, 0)).toBe('< 0.1% of pixels differ');
  });

  it('only calls a pair pixel-identical without a tolerance', () => {
    expect(changedLabel({ changedPixels: 0, coveredPixels: 1000 }, 0)).toBe('pixel-identical');
    expect(changedLabel({ changedPixels: 0, coveredPixels: 1000 }, 8)).toBe('no changes above tolerance');
  });

  it('has nothing to say before any pixel is covered', () => {
    expect(changedLabel({ changedPixels: 0, coveredPixels: 0 }, 0)).toBeNull();
  });
});

describe('colorHex', () => {
  it('writes an opaque color as #RRGGBB', () => {
    expect(colorHex([255, 8, 170, 255])).toBe('#ff08aa');
  });

  it('adds the alpha when the color is see-through', () => {
    expect(colorHex([0, 0, 0, 128])).toBe('#000000/80');
  });
});
