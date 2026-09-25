import { describe, expect, it } from 'vitest';
import { centerOn, fitToScreen, MAX_ZOOM, openingViewport, revealPoint, toWorld, zoomAt } from './viewport';

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
});
