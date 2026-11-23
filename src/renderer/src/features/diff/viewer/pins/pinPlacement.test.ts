import { describe, expect, it } from 'vitest';
import { cardPlacement, pinBounds, pinCardPlacement } from './pinPlacement';

describe('cardPlacement', () => {
  const VIEWPORT = { width: 1000, height: 600 };

  it('goes right of the spot, level with it', () => {
    expect(cardPlacement({ x: 100, y: 50, width: 20, height: 10 }, VIEWPORT, 360)).toEqual({ left: 132, top: 50, maxHeight: 542 });
  });

  it('goes left when the right has no room', () => {
    expect(cardPlacement({ x: 800, y: 50, width: 0, height: 0 }, VIEWPORT, 360)).toMatchObject({ left: 428, top: 50 });
  });

  it('lifts a card beside a spot near the bottom, so more than its header shows', () => {
    expect(cardPlacement({ x: 100, y: 590, width: 0, height: 0 }, VIEWPORT, 360)).toMatchObject({ top: 392, maxHeight: 200 });
  });

  it('goes below the spot when neither side has room, not over what it is about', () => {
    expect(cardPlacement({ x: 150, y: 40, width: 100, height: 60 }, { width: 400, height: 600 }, 360)).toEqual({ left: 32, top: 112, maxHeight: 480 });
  });

  it('goes above it when below has less room', () => {
    expect(cardPlacement({ x: 20, y: 400, width: 300, height: 150 }, { width: 400, height: 600 }, 360)).toEqual({ left: 20, bottom: 212, maxHeight: 380 });
  });

  it('goes over it only when no side has room', () => {
    expect(cardPlacement({ x: 20, y: 100, width: 300, height: 150 }, { width: 400, height: 300 }, 360)).toMatchObject({ left: 20, top: 92 });
  });
});

describe('pinBounds', () => {
  it("covers a point's bubble above it, and an area with its bubble", () => {
    expect(pinBounds({ x: 100, y: 100, width: 0, height: 0 })).toEqual({ x: 100, y: 70, width: 30, height: 30 });
    expect(pinBounds({ x: 100, y: 100, width: 200, height: 50 })).toEqual({ x: 100, y: 70, width: 200, height: 80 });
  });
});

describe('pinCardPlacement', () => {
  it("leaves the stage's floating controls at its right edge clear", () => {
    // 1000 wide, 52 of it the controls': a card right of a pin at 600 would reach 984, under them; it goes left.
    expect(pinCardPlacement({ x: 600, y: 100, width: 0, height: 0 }, { width: 1000, height: 600 })).toMatchObject({ left: 228 });
  });
});
