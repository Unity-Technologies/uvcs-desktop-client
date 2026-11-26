import { describe, expect, it } from 'vitest';
import { gapLayerAlpha, GLOW_LAYERS, glowAtZoom, glowingPathsByColor, glowLayerAlpha, inDrawingOrder, layerWidths } from './mergeLinkGlow';

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

const link = (name: string, color: string, lit: boolean, emphasized = false) => ({ path: name, color, lit, emphasized });

describe('inDrawingOrder', () => {
  it('draws receded links first, then lit ones, and the emphasized on top of every other', () => {
    const order = inDrawingOrder([link('hovered', 'green', true, true), link('lit', 'green', true), link('receded', 'green', false)]);
    expect(order.map(({ path }) => path)).toEqual(['receded', 'lit', 'hovered']);
  });

  it('keeps an emphasized link that a search receded with the receded ones', () => {
    const order = inDrawingOrder([link('lit', 'green', true), link('receded hovered', 'green', false, true)]);
    expect(order.map(({ path }) => path)).toEqual(['receded hovered', 'lit']);
  });

  it('keeps the order within each group', () => {
    expect(inDrawingOrder([link('a', 'green', true), link('b', 'green', true)]).map(({ path }) => path)).toEqual(['a', 'b']);
  });
});

describe('glowingPathsByColor', () => {
  it('gathers the links of one color into one glow, so links sharing a route glow once', () => {
    const groups = glowingPathsByColor([link('a', 'green', true), link('b', 'violet', true), link('c', 'green', true)]);
    expect([...groups]).toEqual([
      ['green', ['a', 'c']],
      ['violet', ['b']],
    ]);
  });

  it('leaves out the links a search receded', () => {
    expect([...glowingPathsByColor([link('lit', 'green', true), link('receded', 'green', false)])]).toEqual([['green', ['lit']]]);
  });
});

describe('gapLayerAlpha', () => {
  it('fades the gap out with the glow, and draws none zoomed far out, where it is under a pixel', () => {
    expect(gapLayerAlpha(1)).toBeGreaterThan(0);
    expect(gapLayerAlpha(0.2)).toBe(0);
  });
});
