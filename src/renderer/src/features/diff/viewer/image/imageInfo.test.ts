import { describe, expect, it } from 'vitest';
import { changedLabel, sideLabel } from './imageInfo';

describe('sideLabel', () => {
  it('shows dimensions and size', () => {
    expect(sideLabel({ width: 64, height: 32 }, 178)).toBe('64×32 · 178 B');
  });
});

describe('changedLabel', () => {
  it('reports the share of covered pixels that differ', () => {
    expect(changedLabel(484, 1000, 0)).toBe('48.4% of pixels differ');
    expect(changedLabel(1, 10_000, 0)).toBe('< 0.1% of pixels differ');
  });

  it('only calls a pair pixel-identical without a tolerance', () => {
    expect(changedLabel(0, 1000, 0)).toBe('pixel-identical');
    expect(changedLabel(0, 1000, 8)).toBe('no changes above tolerance');
  });

  it('has nothing to say before any pixel is covered', () => {
    expect(changedLabel(0, 0, 0)).toBeNull();
  });
});
