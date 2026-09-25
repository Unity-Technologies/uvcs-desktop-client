import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, MIN_ZOOM } from './viewport';
import { accumulateZoom, cubicEaseOut, isDiscreteWheel, wheelZoomFactor, ZOOM_GLIDE_MAX_MS, ZOOM_GLIDE_MS } from './zoom';

const IN = wheelZoomFactor(-100, 0);
const OUT = wheelZoomFactor(100, 0);

describe('zoom', () => {
  it('eases from 0 to 1, fast first', () => {
    expect(cubicEaseOut(0)).toBe(0);
    expect(cubicEaseOut(1)).toBe(1);
    expect(cubicEaseOut(0.5)).toBeGreaterThan(0.5);
  });

  it('tells wheel notches from trackpad pinches', () => {
    expect(isDiscreteWheel(-100, 0)).toBe(true);
    expect(isDiscreteWheel(-3, 1)).toBe(true);
    expect(isDiscreteWheel(-3.5, 0)).toBe(false);
    expect(isDiscreteWheel(12, 0)).toBe(false);
  });

  it('zooms in and out symmetrically by about 11% per notch', () => {
    expect(IN).toBeCloseTo(1 / 0.9);
    expect(IN * OUT).toBeCloseTo(1);
    expect(wheelZoomFactor(-3, 1)).toBeCloseTo(IN);
  });

  it('zooms harder for accelerated multi-notch deltas, up to a ceiling', () => {
    expect(wheelZoomFactor(-300, 0)).toBeGreaterThan(IN);
    expect(wheelZoomFactor(-10000, 0)).toBe(2);
  });

  it('compounds the target and stretches the glide while spinning the same way', () => {
    const first = accumulateZoom(null, 1, IN, 1000);
    expect(first).toEqual({ target: IN, direction: 1, startedAt: 1000, duration: ZOOM_GLIDE_MS });
    const second = accumulateZoom(first, 1.05, IN, 1150);
    expect(second.target).toBeCloseTo(IN * IN);
    expect(second.duration).toBe(ZOOM_GLIDE_MS + 50);
    expect(accumulateZoom(second, 1.1, IN, 1200).duration).toBe(ZOOM_GLIDE_MAX_MS);
  });

  it('starts over from the current zoom when reversing', () => {
    const reversed = accumulateZoom(accumulateZoom(null, 1, IN, 1000), 1.05, OUT, 1100);
    expect(reversed.target).toBeCloseTo(1.05 * OUT);
    expect(reversed.duration).toBe(ZOOM_GLIDE_MS);
  });

  it('keeps the target within the zoom limits', () => {
    expect(accumulateZoom(null, MAX_ZOOM, IN, 0).target).toBe(MAX_ZOOM);
    expect(accumulateZoom(null, MIN_ZOOM, OUT, 0).target).toBe(MIN_ZOOM);
  });
});
