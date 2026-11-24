import { describe, expect, it } from 'vitest';
import { lineActionSpot } from './lineActionSpot';

const view = { left: 200, top: 100 };

describe('lineActionSpot', () => {
  it("centers the button on the line's row", () => {
    const spot = lineActionSpot({ top: 160, bottom: 180, right: 260 }, view, { top: 0, left: 0 });
    expect(spot.top).toBe(70);
  });

  it('starts just inside the number, so the button reaches over the edge into the code', () => {
    const spot = lineActionSpot({ top: 160, bottom: 180, right: 260 }, view, { top: 0, left: 0 });
    expect(spot.left).toBe(57);
  });

  it("is in the container's scrolled content, so it scrolls with the line", () => {
    expect(lineActionSpot({ top: 160, bottom: 180, right: 260 }, view, { top: 500, left: 30 })).toEqual({ top: 570, left: 87 });
  });

  it('centers on a wrapped line, whose row is several lines tall', () => {
    expect(lineActionSpot({ top: 160, bottom: 220, right: 260 }, view, { top: 0, left: 0 }).top).toBe(90);
  });
});
