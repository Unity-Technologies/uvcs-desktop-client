import { describe, expect, it } from 'vitest';
import { wheelGesture } from './wheelGesture';
import { wheelZoomFactor } from './zoom';

const wheel = (deltaY: number, keys: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {}, deltaX = 0, deltaMode = 0) => ({
  deltaX,
  deltaY,
  deltaMode,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...keys,
});

describe('wheelGesture', () => {
  it('scrolls the graph against the wheel, both ways', () => {
    expect(wheelGesture(wheel(30, {}, -10))).toEqual({ kind: 'pan', dx: 10, dy: -30 });
  });

  it('turns a vertical wheel sideways with Shift, but leaves a trackpad swipe as it is', () => {
    expect(wheelGesture(wheel(100, { shiftKey: true }))).toEqual({ kind: 'pan', dx: -100, dy: -0 });
    expect(wheelGesture(wheel(5, { shiftKey: true }, 20))).toEqual({ kind: 'pan', dx: -20, dy: -5 });
  });

  it('glides a zoom step for a wheel notch with ⌘ or Ctrl, in when spinning up', () => {
    expect(wheelGesture(wheel(-100, { metaKey: true }))).toEqual({ kind: 'zoomStep', factor: wheelZoomFactor(-100, 0) });
    expect(wheelGesture(wheel(3, { ctrlKey: true }, 0, 1))).toEqual({ kind: 'zoomStep', factor: wheelZoomFactor(3, 1) });
    expect(wheelZoomFactor(-100, 0)).toBeGreaterThan(1);
  });

  it('follows a trackpad pinch (small deltas with Ctrl) at once, spreading the fingers zooming in', () => {
    const pinch = wheelGesture(wheel(-4, { ctrlKey: true }));
    expect(pinch.kind).toBe('pinch');
    expect(pinch.kind === 'pinch' && pinch.factor).toBeCloseTo(Math.exp(0.04), 10);
  });
});
