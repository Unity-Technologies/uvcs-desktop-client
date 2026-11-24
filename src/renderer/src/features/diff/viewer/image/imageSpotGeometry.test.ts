import { describe, expect, it } from 'vitest';
import { cornerPoint, revealedRect, dragRect, movedSpot, resizedSpot, spotInFrame, spotOfGesture, spotOnScreen, transformShowing } from './imageSpotGeometry';

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

describe('spotInFrame', () => {
  it('places a spot where its image sits in the frame, a point as one pixel', () => {
    expect(spotInFrame({ x: 3, y: 4 }, { x: 10, y: 0 })).toEqual({ x: 13, y: 4, width: 1, height: 1 });
    expect(spotInFrame({ x: 3, y: 4, size: { width: 20, height: 8 } }, { x: 0, y: 2 })).toEqual({ x: 3, y: 6, width: 20, height: 8 });
  });
});

describe('cornerPoint', () => {
  it("is each corner of an area's box", () => {
    const rect = { x: 10, y: 20, width: 30, height: 40 };
    expect(['topLeft', 'topRight', 'bottomLeft', 'bottomRight'].map((corner) => cornerPoint(rect, corner as never))).toEqual([
      { x: 10, y: 20 },
      { x: 40, y: 20 },
      { x: 10, y: 60 },
      { x: 40, y: 60 },
    ]);
  });
});

describe('dragRect', () => {
  it('outlines a drag whichever way it goes', () => {
    expect(dragRect({ x: 50, y: 10 }, { x: 20, y: 40 })).toEqual({ x: 20, y: 10, width: 30, height: 30 });
  });
});

describe('revealedRect', () => {
  const VIEWPORT = { width: 600, height: 400 };
  const AREA = { x: 0, y: 360, width: 960, height: 240 };

  it('brings a whole area into view when it fits at the zoom shown', () => {
    expect(revealedRect(AREA, VIEWPORT, 0.5)).toBe(AREA);
  });

  it("brings an area's corner, where its bubble is, when it's bigger than the view", () => {
    expect(revealedRect(AREA, VIEWPORT, 3.26)).toEqual({ x: 0, y: 360, width: 1, height: 1 });
  });
});
