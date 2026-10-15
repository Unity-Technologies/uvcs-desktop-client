import { describe, expect, it } from 'vitest';
import { canvasSizeChanged, canvasSizeOf } from './canvasSize';

describe('canvasSizeChanged', () => {
  it('applies the first size, even 1×1 at 1: a canvas not yet sized has the browser default', () => {
    expect(canvasSizeChanged(null, canvasSizeOf(1, 1, 1))).toBe(true);
  });

  it('changes nothing for the same size at the same ratio: sizing a canvas again would clear it', () => {
    expect(canvasSizeChanged(canvasSizeOf(800, 600, 2), canvasSizeOf(800, 600, 2))).toBe(false);
  });

  it('applies the same CSS size at another pixel ratio (the window moved to another screen)', () => {
    expect(canvasSizeChanged(canvasSizeOf(800, 600, 1), canvasSizeOf(800, 600, 2))).toBe(true);
  });

  it('changes nothing for fractional sizes rounding to the same pixels, and never goes below 1', () => {
    expect(canvasSizeChanged(canvasSizeOf(800.2, 600.4, 2), canvasSizeOf(799.8, 599.6, 2))).toBe(false);
    expect(canvasSizeOf(0, 0.3, 1)).toEqual({ width: 1, height: 1, pixelRatio: 1 });
  });
});
