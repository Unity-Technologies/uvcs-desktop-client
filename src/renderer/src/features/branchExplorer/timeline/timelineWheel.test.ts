import { describe, expect, it } from 'vitest';
import type { TimelineAxis } from './timelineAxis';
import { timelineWheel, zoomAnchorX } from './timelineWheel';

const wheel = (deltaX: number, deltaY: number, modifiers: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {}) => ({
  deltaX,
  deltaY,
  deltaMode: 0,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...modifiers,
});

describe('timelineWheel', () => {
  it('pans the canvas sideways whichever way the wheel turns', () => {
    expect(timelineWheel(wheel(0, 30))).toEqual({ kind: 'pan', dx: -30 });
    expect(timelineWheel(wheel(-12, 3))).toEqual({ kind: 'pan', dx: 12 });
  });

  it('zooms the canvas with ⌘ or Ctrl, as over the canvas', () => {
    expect(timelineWheel(wheel(0, 100, { metaKey: true })).kind).toBe('zoomStep');
    expect(timelineWheel(wheel(0, 3.5, { ctrlKey: true })).kind).toBe('pinch');
  });
});

describe('zoomAnchorX', () => {
  const axis: TimelineAxis = { worldWidth: 10_000, width: 1_000, inset: 0, columnCount: 150 };
  const screen = { width: 800, height: 600 };

  it('zooms around the point of the graph under the pointer, kept within the screen', () => {
    const viewport = { zoom: 1, panX: -2_000, panY: 0 };
    expect(zoomAnchorX(axis, viewport, screen, 250)).toBe(500);
    expect(zoomAnchorX(axis, viewport, screen, 10)).toBe(0);
    expect(zoomAnchorX(axis, viewport, screen, 900)).toBe(800);
  });
});
