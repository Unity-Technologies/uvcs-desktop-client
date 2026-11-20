import { describe, expect, it } from 'vitest';
import { GLOW_LAYERS, glowAtZoom, glowLayerAlpha, layerWidths } from './mergeLinkGlow';

describe('glowAtZoom', () => {
  it('shows the whole glow from 0.7 up, none from 0.35 down, and fades in between', () => {
    expect(glowAtZoom(2)).toBe(1);
    expect(glowAtZoom(0.7)).toBe(1);
    expect(glowAtZoom(0.525)).toBeCloseTo(0.5);
    expect(glowAtZoom(0.35)).toBe(0);
    expect(glowAtZoom(0.1)).toBe(0);
  });
});

describe('glowLayerAlpha', () => {
  it('glows stronger on a dark graph, where a faint glow would be lost', () => {
    expect(glowLayerAlpha(1, true)).toBeGreaterThan(glowLayerAlpha(1, false));
  });

  it('splits the strength among the layers, which add up to it at the line', () => {
    expect(glowLayerAlpha(1, false) * GLOW_LAYERS).toBeCloseTo(0.16);
    expect(glowLayerAlpha(1, true) * GLOW_LAYERS).toBeCloseTo(0.25);
  });

  it('has no glow zoomed far out', () => {
    expect(glowLayerAlpha(0.2, false)).toBe(0);
    expect(glowLayerAlpha(0.2, true)).toBe(0);
  });
});

describe('layerWidths', () => {
  it('goes from the widest, the line plus its reach on each side, in to just past the line', () => {
    expect(layerWidths(2, 4, 4)).toEqual([10, 8, 6, 4]);
  });
});
