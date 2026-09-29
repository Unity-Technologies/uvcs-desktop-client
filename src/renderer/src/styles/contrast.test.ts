import { describe, expect, it } from 'vitest';
import { contrastRatio, hslAtContrast, hslColor, hueOf } from './contrast';

describe('hueOf', () => {
  it('reads the hue of primaries, mixes and grays', () => {
    expect(hueOf([255, 0, 0])).toBe(0);
    expect(hueOf([0, 255, 0])).toBe(120);
    expect(hueOf([0, 0, 255])).toBe(240);
    expect(hueOf([255, 0, 128])).toBeCloseTo(330, 0);
    expect(hueOf([128, 128, 128])).toBe(0);
  });

  it('gives back the hue an hsl color was made of', () => {
    for (const hue of [8, 60, 152, 212, 316]) expect(hueOf(hslColor(hue, '70%', '40%').rgb)).toBeCloseTo(hue, -1);
  });
});

describe('hslAtContrast', () => {
  const white: [number, number, number] = [255, 255, 255];
  const night: [number, number, number] = [28, 35, 48];

  it('darkens text on a light background just enough to reach the ratio', () => {
    for (const hue of [24, 60, 152, 212]) {
      const text = hslAtContrast(hue, '70%', 6, white);
      expect(contrastRatio(text, white)).toBeGreaterThanOrEqual(6);
      expect(contrastRatio(text, white)).toBeLessThan(6.2);
    }
  });

  it('lightens text on a dark background just enough to reach the ratio', () => {
    for (const hue of [24, 60, 152, 212]) {
      const text = hslAtContrast(hue, '75%', 5, night);
      expect(contrastRatio(text, night)).toBeGreaterThanOrEqual(5);
      expect(contrastRatio(text, night)).toBeLessThan(5.2);
      expect(Math.max(...text)).toBeGreaterThan(Math.max(...night));
    }
  });

  it('keeps the hue', () => {
    expect(hueOf(hslAtContrast(152, '70%', 6, white))).toBeCloseTo(152, -1);
  });

  it('gives black or white when the ratio is out of reach', () => {
    expect(hslAtContrast(60, '70%', 30, white)).toEqual([0, 0, 0]);
    expect(hslAtContrast(60, '70%', 30, night)).toEqual([255, 255, 255]);
  });
});
