import { describe, expect, it } from 'vitest';
import { comparePixels, countChangedPixels, HEATMAP_ACCENT, renderHeatmap } from './pixelComparison';
import { bitmap, opaque, pixelOf } from './testBitmaps';

describe('comparePixels', () => {
  it('scores identical pixels 0, all of them in the histogram at 0', () => {
    const pixels = [opaque(10, 20, 30), opaque(200, 100, 50)];
    const comparison = comparePixels(bitmap(2, 1, pixels), bitmap(2, 1, pixels), 'center');
    expect(Array.from(comparison.difference)).toEqual([0, 0]);
    expect(comparison.coveredPixels).toBe(2);
    expect(comparison.histogram[0]).toBe(2);
    expect(countChangedPixels(comparison.histogram, 0)).toBe(0);
  });

  it('scores a pixel by how much it visibly changed, not by its bits', () => {
    // A bitwise comparison would score 127→128 as the loudest change there is.
    expect(comparePixels(bitmap(1, 1, [opaque(127, 0, 0)]), bitmap(1, 1, [opaque(128, 0, 0)]), 'center').difference[0]).toBe(1);
    expect(comparePixels(bitmap(1, 1, [opaque(0, 0, 0)]), bitmap(1, 1, [opaque(128, 0, 0)]), 'center').difference[0]).toBe(128);
  });

  it('scores a color change under full transparency 0', () => {
    expect(comparePixels(bitmap(1, 1, [[10, 20, 30, 0]]), bitmap(1, 1, [[90, 80, 70, 0]]), 'center').difference[0]).toBe(0);
  });

  it('counts a change of alpha alone, which shows against the checkerboard', () => {
    expect(comparePixels(bitmap(1, 1, [[255, 255, 255, 255]]), bitmap(1, 1, [[255, 255, 255, 55]]), 'center').difference[0]).toBe(200);
  });

  it('scores the pixels only one revision covers 255, counting both revisions as covered', () => {
    const red = opaque(255, 0, 0);
    const comparison = comparePixels(bitmap(1, 1, [red]), bitmap(3, 1, [red, red, red]), 'center');
    expect(comparison).toMatchObject({ width: 3, height: 1, coveredPixels: 3 });
    expect(Array.from(comparison.difference)).toEqual([255, 0, 255]);
    expect(countChangedPixels(comparison.histogram, 0)).toBe(2);
  });

  it('lines revisions up by their top-left corners when anchored there', () => {
    const red = opaque(255, 0, 0);
    expect(Array.from(comparePixels(bitmap(1, 1, [red]), bitmap(3, 1, [red, red, red]), 'top-left').difference)).toEqual([0, 255, 255]);
  });

  it('leaves out the pixels neither revision covers', () => {
    // 2×1 against 1×2: a 2×2 frame whose bottom-right pixel neither covers.
    const comparison = comparePixels(bitmap(2, 1, [opaque(1, 2, 3), opaque(4, 5, 6)]), bitmap(1, 2, [opaque(1, 2, 3), opaque(9, 9, 9)]), 'center');
    expect(Array.from(comparison.difference)).toEqual([0, 255, 255, 0]);
    expect(pixelOf(comparison.ghost, 2, 1, 1)).toEqual([0, 0, 0, 0]);
    expect(comparison.coveredPixels).toBe(3);
    expect(countChangedPixels(comparison.histogram, 0)).toBe(2);
  });

  it('ghosts the new revision in gray, the old one where only it covers', () => {
    const comparison = comparePixels(bitmap(2, 1, [opaque(0, 0, 0), opaque(0, 0, 0)]), bitmap(1, 1, [opaque(255, 255, 255)]), 'top-left');
    expect(pixelOf(comparison.ghost, 2, 0, 0)).toEqual([255, 255, 255, 90]);
    expect(pixelOf(comparison.ghost, 2, 1, 0)).toEqual([0, 0, 0, 90]);
  });
});

describe('countChangedPixels', () => {
  it('counts the pixels above the tolerance', () => {
    const histogram = new Uint32Array(256);
    histogram[0] = 10;
    histogram[5] = 3;
    histogram[6] = 2;
    histogram[255] = 1;
    expect(countChangedPixels(histogram, 0)).toBe(6);
    expect(countChangedPixels(histogram, 5)).toBe(3);
    expect(countChangedPixels(histogram, 255)).toBe(0);
  });
});

describe('renderHeatmap', () => {
  it('shows the ghost where nothing changed and the accent where something did', () => {
    const comparison = comparePixels(bitmap(2, 1, [opaque(10, 20, 30), opaque(0, 0, 0)]), bitmap(2, 1, [opaque(10, 20, 30), opaque(255, 255, 255)]), 'center');
    const heatmap = renderHeatmap(comparison, 0);
    expect(pixelOf(heatmap, 2, 0, 0)).toEqual(pixelOf(comparison.ghost, 2, 0, 0));
    expect(pixelOf(heatmap, 2, 1, 0)).toEqual([...HEATMAP_ACCENT, 255]);
  });

  it('makes the accent more opaque the more a pixel changed, never faint', () => {
    const comparison = comparePixels(bitmap(2, 1, [opaque(100, 100, 100), opaque(100, 100, 100)]), bitmap(2, 1, [opaque(110, 100, 100), opaque(228, 100, 100)]), 'center');
    const heatmap = renderHeatmap(comparison, 0);
    const [faint, loud] = [pixelOf(heatmap, 2, 0, 0)[3]!, pixelOf(heatmap, 2, 1, 0)[3]!];
    expect(faint).toBeGreaterThanOrEqual(140);
    expect(loud).toBeGreaterThan(faint);
  });

  it('shows changes up to the tolerance as unchanged', () => {
    const comparison = comparePixels(bitmap(2, 1, [opaque(100, 100, 100), opaque(100, 100, 100)]), bitmap(2, 1, [opaque(104, 100, 100), opaque(160, 100, 100)]), 'center');
    const heatmap = renderHeatmap(comparison, 10);
    expect(pixelOf(heatmap, 2, 0, 0)).toEqual(pixelOf(comparison.ghost, 2, 0, 0));
    expect(pixelOf(heatmap, 2, 1, 0).slice(0, 3)).toEqual([...HEATMAP_ACCENT]);
  });
});
