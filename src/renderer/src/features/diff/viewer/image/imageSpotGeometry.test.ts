import { describe, expect, it } from 'vitest';
import { cardPlacement, movedSpot, pinBounds, resizedSpot, spotOfGesture, spotOnScreen, transformShowing } from './imageSpotGeometry';

const AT_TWICE = { scale: 2, x: 10, y: 20 };
const NO_OFFSET = { x: 0, y: 0 };
const IMAGE = { width: 100, height: 50 };

describe('spotOnScreen', () => {
  it('places a point and an area as the image shows, its offset in the frame scaled too', () => {
    expect(spotOnScreen({ x: 5, y: 6 }, { x: 3, y: 0 }, AT_TWICE)).toEqual({ x: 26, y: 32, width: 0, height: 0 });
    expect(spotOnScreen({ x: 0, y: 0, size: { width: 10, height: 4 } }, NO_OFFSET, AT_TWICE)).toEqual({ x: 10, y: 20, width: 20, height: 8 });
  });
});

describe('spotOfGesture', () => {
  it('marks the pixel under a click', () => {
    expect(spotOfGesture({ x: 31, y: 41 }, { x: 32, y: 42 }, AT_TWICE, NO_OFFSET, IMAGE)).toEqual({ x: 10, y: 10 });
  });

  it('marks the whole pixels a drag spans, whichever way it goes', () => {
    const area = { x: 10, y: 10, size: { width: 6, height: 3 } };
    expect(spotOfGesture({ x: 30, y: 40 }, { x: 41, y: 45 }, AT_TWICE, NO_OFFSET, IMAGE)).toEqual(area);
    expect(spotOfGesture({ x: 41, y: 45 }, { x: 30, y: 40 }, AT_TWICE, NO_OFFSET, IMAGE)).toEqual(area);
  });

  it('keeps a drag that runs off the image within it', () => {
    expect(spotOfGesture({ x: 200, y: 110 }, { x: 900, y: 900 }, AT_TWICE, NO_OFFSET, IMAGE)).toEqual({ x: 95, y: 45, size: { width: 5, height: 5 } });
  });

  it('marks nothing for a press off the image, around a smaller revision too', () => {
    expect(spotOfGesture({ x: 5, y: 41 }, { x: 5, y: 41 }, AT_TWICE, NO_OFFSET, IMAGE)).toBeNull();
    expect(spotOfGesture({ x: 31, y: 41 }, { x: 31, y: 41 }, AT_TWICE, { x: 20, y: 0 }, IMAGE)).toBeNull();
  });

  it("reads the image's own pixels, where it sits in the frame", () => {
    expect(spotOfGesture({ x: 71, y: 41 }, { x: 71, y: 41 }, AT_TWICE, { x: 20, y: 0 }, IMAGE)).toEqual({ x: 10, y: 10 });
  });
});

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

describe('transformShowing', () => {
  const VIEWPORT = { width: 400, height: 300 };
  const FRAME = { width: 2000, height: 2000 };

  it('leaves a view showing the spot as it is', () => {
    const view = { scale: 1, x: 0, y: 0 };
    expect(transformShowing(view, VIEWPORT, FRAME, { x: 100, y: 100, width: 10, height: 10 })).toBe(view);
  });

  it('centers a spot out of view, at the same zoom', () => {
    expect(transformShowing({ scale: 1, x: 0, y: 0 }, VIEWPORT, FRAME, { x: 1000, y: 800, width: 0, height: 0 })).toEqual({ scale: 1, x: -800, y: -650 });
  });
});

describe('pinBounds', () => {
  it("covers a point's bubble above it, and an area with its bubble", () => {
    expect(pinBounds({ x: 100, y: 100, width: 0, height: 0 })).toEqual({ x: 100, y: 70, width: 30, height: 30 });
    expect(pinBounds({ x: 100, y: 100, width: 200, height: 50 })).toEqual({ x: 100, y: 70, width: 200, height: 80 });
  });
});

describe('movedSpot', () => {
  it('moves a point or an area by whole pixels', () => {
    expect(movedSpot({ x: 10, y: 10 }, { x: 4.4, y: -2.6 }, IMAGE)).toEqual({ x: 14, y: 7 });
    expect(movedSpot({ x: 10, y: 10, size: { width: 20, height: 10 } }, { x: 5, y: 5 }, IMAGE)).toEqual({ x: 15, y: 15, size: { width: 20, height: 10 } });
  });

  it('keeps a point on the image, and an area whole inside it', () => {
    expect(movedSpot({ x: 10, y: 10 }, { x: 500, y: -500 }, IMAGE)).toEqual({ x: 99, y: 0 });
    expect(movedSpot({ x: 10, y: 10, size: { width: 20, height: 10 } }, { x: 500, y: 500 }, IMAGE)).toEqual({ x: 80, y: 40, size: { width: 20, height: 10 } });
  });
});

describe('resizedSpot', () => {
  const AREA = { x: 10, y: 10, size: { width: 20, height: 10 } };

  it('moves the corner dragged, the opposite one staying', () => {
    expect(resizedSpot(AREA, 'bottomRight', { x: 40.4, y: 30 }, IMAGE)).toEqual({ x: 10, y: 10, size: { width: 30, height: 20 } });
    expect(resizedSpot(AREA, 'topLeft', { x: 5, y: 2 }, IMAGE)).toEqual({ x: 5, y: 2, size: { width: 25, height: 18 } });
  });

  it('turns over when dragged past the other corner, and stays a pixel at least', () => {
    expect(resizedSpot(AREA, 'bottomRight', { x: 4, y: 6 }, IMAGE)).toEqual({ x: 4, y: 6, size: { width: 6, height: 4 } });
    expect(resizedSpot(AREA, 'topRight', { x: 10, y: 5 }, IMAGE)).toEqual({ x: 10, y: 5, size: { width: 1, height: 15 } });
  });

  it('stays within the image', () => {
    expect(resizedSpot(AREA, 'bottomRight', { x: 900, y: 900 }, IMAGE)).toEqual({ x: 10, y: 10, size: { width: 90, height: 40 } });
  });
});
