import { describe, expect, it } from 'vitest';
import { centerOn, clampViewport, fitToScreen, MAX_ZOOM, openingViewport, OVERSCROLL, revealPoint, toWorld, zoomAt } from './viewport';

const screen = { width: 800, height: 600 };

describe('viewport', () => {
  it('keeps the point under the cursor fixed while zooming', () => {
    const start = { panX: 10, panY: 20, zoom: 1 };
    const before = toWorld(start, 300, 200);
    const zoomed = zoomAt(start, 2, 300, 200);
    expect(zoomed.zoom).toBe(2);
    expect(toWorld(zoomed, 300, 200)).toEqual(before);
  });

  it('clamps the zoom', () => {
    expect(zoomAt({ panX: 0, panY: 0, zoom: 2 }, 10, 0, 0).zoom).toBe(MAX_ZOOM);
  });

  it('centers a world point', () => {
    const centered = centerOn({ panX: 0, panY: 0, zoom: 2 }, 100, 50, screen);
    expect(centered.panX + 100 * 2).toBe(400);
    expect(centered.panY + 50 * 2).toBe(300);
  });

  it('fits content without zooming in past 1:1', () => {
    expect(fitToScreen({ width: 400, height: 300 }, screen).zoom).toBe(1);
    expect(fitToScreen({ width: 1600, height: 300 }, screen).zoom).toBe(0.5);
  });

  it('opens small graphs fitted and wide graphs with the focus on the right', () => {
    expect(openingViewport({ width: 400, height: 300 }, screen, 100, 100).zoom).toBe(1);
    const wide = openingViewport({ width: 5000, height: 300 }, screen, 4000, 100);
    expect(wide.panX + 4000).toBeCloseTo(800 * 0.72);
    expect(wide.panY).toBe(0);
  });

  it('never opens past the end of the graph', () => {
    const atEnd = openingViewport({ width: 5000, height: 300 }, screen, 4990, 100);
    expect(atEnd.panX).toBe(800 - 5000);
  });

  it('only scrolls to reveal points that are off screen', () => {
    const viewport = { panX: 0, panY: 0, zoom: 1 };
    expect(revealPoint(viewport, 300, 300, screen)).toBe(viewport);
    expect(revealPoint(viewport, 3000, 300, screen).panX).toBe(400 - 3000);
  });

  it('pins a graph smaller than the screen to the top left', () => {
    const small = { width: 400, height: 300 };
    expect(clampViewport({ panX: 500, panY: -200, zoom: 1 }, small, screen)).toEqual({ panX: 0, panY: 0, zoom: 1 });
    expect(clampViewport({ panX: 500, panY: 400, zoom: 0.5 }, small, screen)).toEqual({ panX: 0, panY: 14, zoom: 0.5 });
  });

  it('lets a larger graph overscroll a little, but never scroll off screen', () => {
    const large = { width: 3000, height: 2000 };
    expect(clampViewport({ panX: 900, panY: 500, zoom: 1 }, large, screen)).toMatchObject({ panX: OVERSCROLL, panY: 0 });
    expect(clampViewport({ panX: -9000, panY: -9000, zoom: 1 }, large, screen)).toMatchObject({
      panX: 800 - 3000 - OVERSCROLL,
      panY: 600 - 2000 - OVERSCROLL / 2,
    });
  });

  it('leaves a viewport that is already in bounds untouched', () => {
    const viewport = { panX: -100, panY: -100, zoom: 1 };
    expect(clampViewport(viewport, { width: 3000, height: 2000 }, screen)).toBe(viewport);
  });

  it('clamps each axis on its own', () => {
    const wide = { width: 3000, height: 300 };
    expect(clampViewport({ panX: -500, panY: 250, zoom: 1 }, wide, screen)).toEqual({ panX: -500, panY: 0, zoom: 1 });
  });
});
