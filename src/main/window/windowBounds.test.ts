import { describe, expect, it } from 'vitest';
import { restoreWindowBounds } from './windowBounds';

const laptop = { x: 0, y: 25, width: 1512, height: 920 };
const external = { x: 1512, y: 0, width: 2560, height: 1415 };
const saved = (x: number, y: number, width: number, height: number) => ({ x, y, width, height, maximized: false });

describe('restoreWindowBounds', () => {
  it('keeps a window that still fits where it was', () => {
    expect(restoreWindowBounds(saved(100, 80, 1200, 800), [laptop])).toEqual({ x: 100, y: 80, width: 1200, height: 800 });
  });

  it('shrinks a window to the display it is on', () => {
    expect(restoreWindowBounds(saved(10, 30, 2400, 1400), [laptop])).toEqual({ x: 10, y: 30, width: 1512, height: 920 });
  });

  it('brings back a window from an unplugged monitor, centered on the nearest display', () => {
    expect(restoreWindowBounds(saved(1800, 100, 1400, 900), [laptop])).toEqual({ x: 56, y: 35, width: 1400, height: 900 });
  });

  it('keeps a window on a second monitor that is still there', () => {
    expect(restoreWindowBounds(saved(1800, 100, 1400, 900), [laptop, external])).toEqual({ x: 1800, y: 100, width: 1400, height: 900 });
  });

  it('moves a window whose title bar is above the screen', () => {
    expect(restoreWindowBounds(saved(100, -300, 1200, 800), [laptop])?.y).toBe(85);
  });

  it('never goes below the minimum size, and ignores missing bounds', () => {
    expect(restoreWindowBounds(saved(0, 30, 200, 100), [laptop])).toMatchObject({ width: 960, height: 600 });
    expect(restoreWindowBounds(null, [laptop])).toBeNull();
  });
});
