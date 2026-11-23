import { describe, expect, it } from 'vitest';
import { takesComments } from './imageAnnotations';
import { spotInFrame } from './imageSpotGeometry';

describe('takesComments', () => {
  it('offers comments where the place takes them on a side the viewer shows', () => {
    expect(takesComments({ commentsOn: 'new' }, { old: 1, new: 1 })).toBe(true);
    expect(takesComments({ commentsOn: 'old' }, { old: 1, new: null })).toBe(true);
  });

  it("offers none outside a review, or on a side that isn't shown", () => {
    expect(takesComments(null, { new: 1 })).toBe(false);
    expect(takesComments({ commentsOn: null }, { new: 1 })).toBe(false);
    expect(takesComments({ commentsOn: 'new' }, { old: 1, new: null })).toBe(false);
  });
});

describe('spotInFrame', () => {
  it('places a spot where its image sits in the frame, a point as one pixel', () => {
    expect(spotInFrame({ x: 3, y: 4 }, { x: 10, y: 0 })).toEqual({ x: 13, y: 4, width: 1, height: 1 });
    expect(spotInFrame({ x: 3, y: 4, size: { width: 20, height: 8 } }, { x: 0, y: 2 })).toEqual({ x: 3, y: 6, width: 20, height: 8 });
  });
});
