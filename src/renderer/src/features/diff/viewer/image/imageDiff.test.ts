import { describe, expect, it } from 'vitest';
import {
  anchoredOffset,
  clampPan,
  clampZoom,
  composedSize,
  computeDiff,
  countAbove,
  DIFF_ACCENT,
  findChangedRegions,
  fitZoom,
  isWholeFrameRegion,
  MAX_ZOOM,
  MIN_ZOOM,
  type RgbaBitmap,
  rectTransform,
  renderDiffFrame,
  zoomAroundPoint,
  zoomLabel,
} from './imageDiff';

/** Build a bitmap from per-pixel RGBA tuples (row-major). */
function bitmap(width: number, height: number, pixels: number[][]): RgbaBitmap {
  const data = new Uint8ClampedArray(width * height * 4);
  pixels.forEach((px, i) => {
    data.set(px, i * 4);
  });
  return { data, width, height };
}

/** Read pixel (x, y) of an RGBA buffer as a tuple. */
function px(data: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  const i = (y * width + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

/** Build a delta map from a string sketch: '#' changed (255), '.' quiet (0). */
function deltaMap(rows: string[]): { delta: Uint8Array; width: number; height: number } {
  const width = rows[0].length;
  const height = rows.length;
  const delta = new Uint8Array(width * height);
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x++) if (row[x] === '#') delta[y * width + x] = 255;
  });
  return { delta, width, height };
}

const opaque = (r: number, g: number, b: number) => [r, g, b, 255];

describe('composedSize / anchoredOffset', () => {
  it('composed frame is the max of both sizes', () => {
    expect(composedSize({ width: 4, height: 10 }, { width: 6, height: 2 })).toEqual({
      width: 6,
      height: 10,
    });
  });

  it('center anchor floors to whole pixels', () => {
    expect(anchoredOffset({ width: 10, height: 10 }, { width: 4, height: 4 }, 'center')).toEqual({
      x: 3,
      y: 3,
    });
    expect(anchoredOffset({ width: 5, height: 5 }, { width: 2, height: 2 }, 'center')).toEqual({
      x: 1,
      y: 1,
    });
  });

  it('top-left anchor pins to the origin', () => {
    expect(anchoredOffset({ width: 10, height: 10 }, { width: 4, height: 4 }, 'top-left')).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('computeDiff', () => {
  it('identical pixels score zero and fill the histogram at 0', () => {
    const a = bitmap(2, 1, [opaque(10, 20, 30), opaque(200, 100, 50)]);
    const b = bitmap(2, 1, [opaque(10, 20, 30), opaque(200, 100, 50)]);
    const d = computeDiff(a, b, 'center');
    expect(Array.from(d.delta)).toEqual([0, 0]);
    expect(d.coveredPixels).toBe(2);
    expect(d.histogram[0]).toBe(2);
    expect(countAbove(d.histogram, 0)).toBe(0);
  });

  it('delta is monotonic in visual change, not bit patterns', () => {
    // The old ~(XOR) scored 127→128 as the loudest possible change; the
    // perceptual delta scores it 1 and 0→128 as 128.
    const tiny = computeDiff(bitmap(1, 1, [opaque(127, 0, 0)]), bitmap(1, 1, [opaque(128, 0, 0)]), 'center');
    const large = computeDiff(bitmap(1, 1, [opaque(0, 0, 0)]), bitmap(1, 1, [opaque(128, 0, 0)]), 'center');
    expect(tiny.delta[0]).toBe(1);
    expect(large.delta[0]).toBe(128);
  });

  it('invisible color change under zero alpha scores zero', () => {
    const a = bitmap(1, 1, [[10, 20, 30, 0]]);
    const b = bitmap(1, 1, [[90, 80, 70, 0]]);
    expect(computeDiff(a, b, 'center').delta[0]).toBe(0);
  });

  it('alpha-only change registers via the alpha term', () => {
    // Same white RGB — composited-on-white sides are identical, but the
    // pixel visibly changes against the checkerboard, so |Δalpha| carries it.
    const a = bitmap(1, 1, [[255, 255, 255, 255]]);
    const b = bitmap(1, 1, [[255, 255, 255, 55]]);
    expect(computeDiff(a, b, 'center').delta[0]).toBe(200);
  });

  it('different sizes: single-coverage pixels score 255 and covered is the union', () => {
    const small = bitmap(1, 1, [opaque(255, 0, 0)]);
    const wide = bitmap(3, 1, [opaque(255, 0, 0), opaque(255, 0, 0), opaque(255, 0, 0)]);
    const d = computeDiff(small, wide, 'center');
    expect(d.width).toBe(3);
    expect(d.height).toBe(1);
    expect(Array.from(d.delta)).toEqual([255, 0, 255]);
    expect(d.coveredPixels).toBe(3);
    expect(countAbove(d.histogram, 0)).toBe(2);
  });

  it('top-left anchor aligns origins instead of centers', () => {
    // 1×1 vs 3×1 of the same red: anchored top-left the overlap is pixel 0.
    const small = bitmap(1, 1, [opaque(255, 0, 0)]);
    const wide = bitmap(3, 1, [opaque(255, 0, 0), opaque(255, 0, 0), opaque(255, 0, 0)]);
    const d = computeDiff(small, wide, 'top-left');
    expect(Array.from(d.delta)).toEqual([0, 255, 255]);
  });

  it('disjoint-axis sizes keep both single-coverage cells and skip uncovered ones', () => {
    // 2×1 vs 1×2 → 2×2 frame; both anchor at (0,0). Cell (1,1) is covered by
    // neither side and must stay quiet and outside the covered count.
    const horizontal = bitmap(2, 1, [opaque(1, 2, 3), opaque(4, 5, 6)]);
    const vertical = bitmap(1, 2, [opaque(1, 2, 3), opaque(9, 9, 9)]);
    const d = computeDiff(horizontal, vertical, 'center');
    expect(d.width).toBe(2);
    expect(d.height).toBe(2);
    expect(d.delta[0]).toBe(0); // overlap, identical
    expect(d.delta[1]).toBe(255); // horizontal-only
    expect(d.delta[2]).toBe(255); // vertical-only
    expect(d.delta[3]).toBe(0); // covered by neither
    expect(d.coveredPixels).toBe(3);
    expect(countAbove(d.histogram, 0)).toBe(2);
  });
});

describe('countAbove', () => {
  it('sums the histogram strictly above the threshold', () => {
    const histogram = new Uint32Array(256);
    histogram[0] = 10;
    histogram[5] = 3;
    histogram[6] = 2;
    histogram[255] = 1;
    expect(countAbove(histogram, 0)).toBe(6);
    expect(countAbove(histogram, 5)).toBe(3);
    expect(countAbove(histogram, 255)).toBe(0);
  });
});

describe('renderDiffFrame', () => {
  it('quiet pixels show the underlay, changed pixels the accent', () => {
    const a = bitmap(2, 1, [opaque(10, 20, 30), opaque(0, 0, 0)]);
    const b = bitmap(2, 1, [opaque(10, 20, 30), opaque(255, 255, 255)]);
    const d = computeDiff(a, b, 'center');
    const frame = renderDiffFrame(d, 0);
    // Pixel 0 unchanged → the ghost underlay byte-for-byte.
    expect(px(frame, 2, 0, 0)).toEqual(px(d.underlay, 2, 0, 0));
    // Pixel 1 changed maximally → solid accent.
    expect(px(frame, 2, 1, 0)).toEqual([...DIFF_ACCENT, 255]);
  });

  it('accent opacity grows with the delta', () => {
    const a = bitmap(2, 1, [opaque(100, 100, 100), opaque(100, 100, 100)]);
    const b = bitmap(2, 1, [opaque(110, 100, 100), opaque(228, 100, 100)]);
    const d = computeDiff(a, b, 'center');
    const frame = renderDiffFrame(d, 0);
    const faint = px(frame, 2, 0, 0)[3];
    const loud = px(frame, 2, 1, 0)[3];
    expect(faint).toBeGreaterThanOrEqual(140); // visible floor
    expect(loud).toBeGreaterThan(faint);
  });

  it('tolerance masks deltas at or below it', () => {
    const a = bitmap(2, 1, [opaque(100, 100, 100), opaque(100, 100, 100)]);
    const b = bitmap(2, 1, [opaque(104, 100, 100), opaque(160, 100, 100)]);
    const d = computeDiff(a, b, 'center');
    const frame = renderDiffFrame(d, 10);
    expect(px(frame, 2, 0, 0)).toEqual(px(d.underlay, 2, 0, 0)); // delta 4 → quiet
    expect(px(frame, 2, 1, 0).slice(0, 3)).toEqual([...DIFF_ACCENT]); // delta 60 → accent
  });
});

describe('findChangedRegions', () => {
  it('one connected blob yields its bounding box and pixel count', () => {
    const { delta, width, height } = deltaMap(['........', '..##....', '..###...', '........']);
    const regions = findChangedRegions(delta, width, height, 0);
    expect(regions).toEqual([{ x: 2, y: 1, width: 3, height: 2, pixels: 5 }]);
  });

  it('distant blobs stay separate and sort in reading order', () => {
    const rows = ['#.................', '..................', '..................', '.................#'];
    const { delta, width, height } = deltaMap(rows);
    const regions = findChangedRegions(delta, width, height, 0, { mergeGap: 2 });
    expect(regions).toHaveLength(2);
    expect(regions[0]).toMatchObject({ x: 0, y: 0 });
    expect(regions[1]).toMatchObject({ x: 17, y: 3 });
  });

  it('blobs within the merge gap collapse into one region', () => {
    const { delta, width, height } = deltaMap(['#...#', '.....']);
    const regions = findChangedRegions(delta, width, height, 0, { mergeGap: 4 });
    expect(regions).toEqual([{ x: 0, y: 0, width: 5, height: 1, pixels: 2 }]);
  });

  it('threshold filters quiet pixels out of regions', () => {
    const delta = new Uint8Array([5, 0, 200, 0]);
    const regions = findChangedRegions(delta, 4, 1, 10, { mergeGap: 0 });
    expect(regions).toEqual([{ x: 2, y: 0, width: 1, height: 1, pixels: 1 }]);
  });

  it('noise collapses to one union region once blobs exceed the cap', () => {
    // Isolated pixels on a checker-ish grid: 3 blobs with a cap of 2.
    const { delta, width, height } = deltaMap(['#.#.#', '.....']);
    const regions = findChangedRegions(delta, width, height, 0, { mergeGap: 0, maxBlobs: 2 });
    expect(regions).toEqual([{ x: 0, y: 0, width: 5, height: 1, pixels: 3 }]);
  });

  it('isWholeFrameRegion flags near-global regions, not local ones', () => {
    const frame = { width: 100, height: 100 };
    const global = { x: 2, y: 3, width: 95, height: 94, pixels: 1 };
    const tall = { x: 0, y: 0, width: 10, height: 100, pixels: 1 };
    expect(isWholeFrameRegion(global, frame)).toBe(true);
    expect(isWholeFrameRegion(tall, frame)).toBe(false); // full height, sliver wide
  });

  it('region count over the max re-merges with a doubled gap', () => {
    const { delta, width, height } = deltaMap(['#....#....#']);
    const regions = findChangedRegions(delta, width, height, 0, { mergeGap: 3, maxRegions: 1 });
    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({ x: 0, width: 11, pixels: 3 });
  });
});

describe('zoom math', () => {
  const frame = { width: 800, height: 600 };

  it('clampZoom respects the bounds', () => {
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(clampZoom(1e9)).toBe(MAX_ZOOM);
    expect(clampZoom(2)).toBe(2);
  });

  it('fitZoom fits large images with a margin and never upscales small ones', () => {
    // 8000×600 in 800×600 with 24px margins: width-bound → (800−48)/8000.
    expect(fitZoom(frame, { width: 8000, height: 600 })).toBeCloseTo(752 / 8000, 6);
    // A 16×16 icon must stay at 100%, not blow up to fill the pane.
    expect(fitZoom(frame, { width: 16, height: 16 })).toBe(1);
    expect(fitZoom(frame, { width: 0, height: 0 })).toBe(1);
  });

  it('clampPan centers axes that fit and clamps axes that overflow', () => {
    const image = { width: 100, height: 2000 };
    const t = clampPan({ scale: 1, x: -500, y: -5000 }, frame, image);
    expect(t.x).toBe((frame.width - 100) / 2); // fits → centered
    expect(t.y).toBe(frame.height - 2000); // overflows → clamped to bottom edge
    const t2 = clampPan({ scale: 1, x: 0, y: 99 }, frame, image);
    expect(t2.y).toBe(0); // can't pan past the top edge either
  });

  it('zoomAroundPoint keeps the image point under the anchor fixed', () => {
    const image = { width: 4000, height: 4000 };
    const t = { scale: 1, x: -100, y: -200 };
    const anchor = { x: 400, y: 300 };
    const next = zoomAroundPoint(t, 2, anchor, frame, image);
    // The image-space point at the anchor before…
    const beforeX = (anchor.x - t.x) / t.scale;
    const beforeY = (anchor.y - t.y) / t.scale;
    // …must sit at the anchor after.
    expect(next.x + beforeX * next.scale).toBeCloseTo(anchor.x, 6);
    expect(next.y + beforeY * next.scale).toBeCloseTo(anchor.y, 6);
  });

  it('rectTransform centers the rect and upscales, capped at maxScale', () => {
    // A 10×10 region in an 800×600 pane: height-bound → (600−96)/10 = 50.4,
    // capped at the 16× region max.
    const t = rectTransform(frame, { x: 100, y: 200, width: 10, height: 10 });
    expect(t.scale).toBe(16);
    // The rect center (105, 205) must land on the viewport center.
    expect(t.x + 105 * t.scale).toBeCloseTo(frame.width / 2, 6);
    expect(t.y + 205 * t.scale).toBeCloseTo(frame.height / 2, 6);
    // Large rects scale down to fit, like fitZoom but margin-48.
    const big = rectTransform(frame, { x: 0, y: 0, width: 2000, height: 100 });
    expect(big.scale).toBeCloseTo(704 / 2000, 6);
  });

  it('zoomLabel formats round and tiny percentages', () => {
    expect(zoomLabel(1)).toBe('100%');
    expect(zoomLabel(0.333)).toBe('33%');
    expect(zoomLabel(0.063)).toBe('6.3%');
    expect(zoomLabel(16)).toBe('1600%');
  });
});
