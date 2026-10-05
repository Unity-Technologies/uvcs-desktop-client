import { describe, expect, it } from 'vitest';
import { fullHeatAt, ghostColors, heatColors } from './heatColors';

const clay: [number, number, number] = [0.5, 0.5, 0.5];
const hot: [number, number, number] = [0, 0, 1];
const rounded = (values: Float32Array): number[] => [...values].map((value) => Number(value.toFixed(3)));

describe('heatColors', () => {
  it('keeps the clay within the tolerance, and turns to the accent as far as a vertex moved', () => {
    expect(rounded(heatColors(new Float32Array([0, 0.1, 1, 5]), 0.1, 1, clay, hot))).toEqual([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0, 0, 1, 0, 0, 1]);
  });

  it('shows a change just past the tolerance clearly', () => {
    const [r] = heatColors(new Float32Array([0.1001]), 0.1, 1, clay, hot);
    expect(r).toBeLessThan(0.35);
  });
});

describe('ghostColors', () => {
  it('shows the version before only where it is gone', () => {
    const colors = ghostColors(new Float32Array([0, 1]), 0.1, 1, [1, 0, 0]);
    expect(rounded(colors)).toEqual([1, 0, 0, 0, 1, 0, 0, 0.65]);
  });
});

describe('fullHeatAt', () => {
  it('is ten times the tolerance, or a fiftieth of the model when the tolerance is tiny', () => {
    expect(fullHeatAt(0.01, 1)).toBeCloseTo(0.1);
    expect(fullHeatAt(0, 10)).toBeCloseTo(0.2);
  });
});
