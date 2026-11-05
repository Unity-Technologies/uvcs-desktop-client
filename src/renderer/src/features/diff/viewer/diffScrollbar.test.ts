import { describe, expect, it } from 'vitest';
import { scrollTopForTrackPoint } from './changeMarks';
import { MIN_THUMB_HEIGHT, pressesThumb, scrollTopAfterDrag, thumbOf } from './diffScrollbar';

const sizes = { contentHeight: 4000, viewHeight: 500, trackHeight: 500 };

describe('thumbOf', () => {
  it("is the view's share of the track, at the top before scrolling", () => {
    expect(thumbOf({ ...sizes, scrollTop: 0 })).toEqual({ top: 0, height: 62.5 });
  });

  it('runs down the track as the view scrolls, to its bottom at the end of the content', () => {
    expect(thumbOf({ ...sizes, scrollTop: 1750 })).toEqual({ top: 218.75, height: 62.5 });
    expect(thumbOf({ ...sizes, scrollTop: 3500 })).toEqual({ top: 437.5, height: 62.5 });
  });

  it('is never shorter than can be grabbed, however long the content', () => {
    const thumb = thumbOf({ ...sizes, contentHeight: 1_000_000, scrollTop: 999_500 });
    expect(thumb).toEqual({ top: 500 - MIN_THUMB_HEIGHT, height: MIN_THUMB_HEIGHT });
  });

  it('stays within the track past the ends', () => {
    expect(thumbOf({ ...sizes, scrollTop: -40 }).top).toBe(0);
    expect(thumbOf({ ...sizes, scrollTop: 9000 }).top).toBe(437.5);
  });

  it('fills the track when the content fits', () => {
    expect(thumbOf({ ...sizes, contentHeight: 400, scrollTop: 0 })).toEqual({ top: 0, height: 500 });
  });
});

describe('scrollTopAfterDrag', () => {
  it('scrolls the content by as much as the thumb moved of its travel', () => {
    // The thumb travels 437.5 px for 3,500 px of content: 8 px of content for each.
    expect(scrollTopAfterDrag(0, 100, sizes)).toBe(800);
    expect(scrollTopAfterDrag(2000, -50, sizes)).toBe(1600);
  });

  it('scrolls no further than the ends', () => {
    expect(scrollTopAfterDrag(100, -400, sizes)).toBe(0);
    expect(scrollTopAfterDrag(3000, 400, sizes)).toBe(3500);
  });

  it('scrolls nothing when the content fits', () => {
    expect(scrollTopAfterDrag(0, 100, { ...sizes, contentHeight: 400 })).toBe(0);
  });
});

describe('a press on the track', () => {
  it('scrolls to center the point pressed, and a drag from there goes on from it, as on macOS', () => {
    const pressed = scrollTopForTrackPoint(250, sizes);
    expect(pressed).toBe(1750);
    expect(scrollTopAfterDrag(pressed, 40, sizes)).toBe(2070);
  });
});

describe('pressesThumb', () => {
  const thumb = { top: 100, height: 60 };

  it("takes the thumb from a press on any of its rows, whatever the point across the track's width", () => {
    expect(pressesThumb(100, thumb)).toBe(true);
    expect(pressesThumb(130, thumb)).toBe(true);
    expect(pressesThumb(160, thumb)).toBe(true);
  });

  it('leaves a press above or below it to the track, which scrolls there', () => {
    expect(pressesThumb(99, thumb)).toBe(false);
    expect(pressesThumb(161, thumb)).toBe(false);
  });
});
