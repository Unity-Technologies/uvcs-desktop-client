import { describe, expect, it } from 'vitest';
import {
  clampPan,
  clampZoom,
  doubleClickZoomsIn,
  fittedTransform,
  fitZoom,
  framePixelAt,
  MAX_ZOOM,
  MIN_ZOOM,
  pannedBy,
  rectTransform,
  wheelZoomScale,
  zoomAroundPoint,
  zoomLabel,
} from './viewTransform';

const viewport = { width: 800, height: 600 };

describe('clampZoom', () => {
  it('keeps the scale within the zoom bounds', () => {
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(clampZoom(1e9)).toBe(MAX_ZOOM);
    expect(clampZoom(2)).toBe(2);
  });
});

describe('fitZoom', () => {
  it('fits a large image with a margin', () => {
    // 8000×600 in 800×600 with 24px margins: (800 − 48) / 8000.
    expect(fitZoom(viewport, { width: 8000, height: 600 })).toBeCloseTo(752 / 8000, 6);
  });

  it('never zooms a small image past 100%', () => {
    expect(fitZoom(viewport, { width: 16, height: 16 })).toBe(1);
    expect(fitZoom(viewport, { width: 0, height: 0 })).toBe(1);
  });
});

describe('fittedTransform', () => {
  it('centers the fitted image', () => {
    expect(fittedTransform(viewport, { width: 100, height: 50 })).toEqual({ scale: 1, x: 350, y: 275 });
  });
});

describe('clampPan', () => {
  const image = { width: 100, height: 2000 };

  it('centers an axis where the image fits and stops a larger one at its edges', () => {
    expect(clampPan({ scale: 1, x: -500, y: -5000 }, viewport, image)).toEqual({ scale: 1, x: 350, y: viewport.height - 2000 });
    expect(clampPan({ scale: 1, x: 0, y: 99 }, viewport, image).y).toBe(0);
  });

  it('pans by a distance within the same edges', () => {
    expect(pannedBy({ scale: 1, x: 350, y: -100 }, 40, -30, viewport, image)).toEqual({ scale: 1, x: 350, y: -130 });
    expect(pannedBy({ scale: 1, x: 350, y: -100 }, 0, 500, viewport, image).y).toBe(0);
  });
});

describe('zoomAroundPoint', () => {
  it('keeps the image pixel under the point where it was', () => {
    const transform = { scale: 1, x: -100, y: -200 };
    const anchor = { x: 400, y: 300 };
    const zoomed = zoomAroundPoint(transform, 2, anchor, viewport, { width: 4000, height: 4000 });
    expect(zoomed.x + (anchor.x - transform.x) * zoomed.scale).toBeCloseTo(anchor.x, 6);
    expect(zoomed.y + (anchor.y - transform.y) * zoomed.scale).toBeCloseTo(anchor.y, 6);
  });
});

describe('rectTransform', () => {
  it('centers a small region zoomed in, up to 16×', () => {
    // A 10×10 region: (600 − 96) / 10 = 50.4, capped at 16.
    const transform = rectTransform(viewport, { x: 100, y: 200, width: 10, height: 10 });
    expect(transform.scale).toBe(16);
    expect(transform.x + 105 * transform.scale).toBeCloseTo(viewport.width / 2, 6);
    expect(transform.y + 205 * transform.scale).toBeCloseTo(viewport.height / 2, 6);
  });

  it('zooms out to a large region with a 48px margin', () => {
    expect(rectTransform(viewport, { x: 0, y: 0, width: 2000, height: 100 }).scale).toBeCloseTo(704 / 2000, 6);
  });
});

describe('wheelZoomScale', () => {
  it('zooms in as the wheel goes up and out as it goes down, by the same factor', () => {
    const zoomedIn = wheelZoomScale(1, -5, true);
    expect(zoomedIn).toBeGreaterThan(1);
    expect(wheelZoomScale(zoomedIn, 5, true)).toBeCloseTo(1, 10);
  });

  it('steps a mouse notch gently, however large its delta', () => {
    expect(wheelZoomScale(1, -100, true)).toBe(wheelZoomScale(1, -16, true));
    expect(wheelZoomScale(1, -100, true)).toBeCloseTo(Math.exp(16 * 0.012), 10);
  });

  it('reads a delta in lines as 16 pixels a line', () => {
    expect(wheelZoomScale(1, -0.5, false)).toBe(wheelZoomScale(1, -8, true));
  });
});

describe('doubleClickZoomsIn', () => {
  it('zooms to actual size below 100%, and back to fit from it', () => {
    expect(doubleClickZoomsIn(0.5)).toBe(true);
    expect(doubleClickZoomsIn(1)).toBe(false);
    expect(doubleClickZoomsIn(4)).toBe(false);
  });
});

describe('framePixelAt', () => {
  const image = { width: 10, height: 10 };

  it('finds the pixel under a point of the viewport', () => {
    expect(framePixelAt({ x: 117, y: 29 }, { scale: 8, x: 100, y: 20 }, image)).toEqual({ x: 2, y: 1 });
  });

  it('finds none off the image', () => {
    expect(framePixelAt({ x: 99, y: 29 }, { scale: 8, x: 100, y: 20 }, image)).toBeNull();
    expect(framePixelAt({ x: 180, y: 29 }, { scale: 8, x: 100, y: 20 }, image)).toBeNull();
  });
});

describe('zoomLabel', () => {
  it('says the zoom as a whole percentage, with a decimal below 10%', () => {
    expect(zoomLabel(1)).toBe('100%');
    expect(zoomLabel(0.333)).toBe('33%');
    expect(zoomLabel(0.063)).toBe('6.3%');
    expect(zoomLabel(16)).toBe('1600%');
  });
});
