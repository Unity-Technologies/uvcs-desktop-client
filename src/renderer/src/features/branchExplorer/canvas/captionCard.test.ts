import { describe, expect, it } from 'vitest';
import { captionCardCorner, captionCardMaxWidth, cardMaxWidth, keepInside } from './captionCard';

describe('captionCardCorner', () => {
  it('puts the text of the card on the caption: same first glyph, same baseline', () => {
    const origin = { x: 10, y: 17.5 };
    const { left, top } = captionCardCorner({ x: 200, baseline: 104 }, origin);
    expect(left + origin.x).toBe(200);
    expect(top + origin.y).toBe(104);
  });
});

describe('captionCardMaxWidth', () => {
  it('lets the card grow to a reading measure away from the edge', () => {
    expect(captionCardMaxWidth(100, 1200, 1600)).toBe(400);
  });

  it('wraps a card near the right edge in the room left, so its text stays on the caption', () => {
    const width = captionCardMaxWidth(900, 1200, 1600);
    expect(900 - 10 + width).toBe(1200 - 8);
  });

  it('gives up the alignment when the room left is too narrow to read', () => {
    expect(captionCardMaxWidth(1100, 1200, 1600)).toBe(400);
  });
});

describe('keepInside', () => {
  it('keeps a card where it is when it fits', () => {
    expect(keepInside(200, 300, 1000)).toBe(200);
  });

  it('moves it just enough to stay inside the canvas', () => {
    expect(keepInside(900, 300, 1000)).toBe(1000 - 300 - 8);
    expect(keepInside(-20, 300, 1000)).toBe(8);
  });
});

describe('cardMaxWidth', () => {
  it('reads comfortably on large windows and never covers too much of a small one', () => {
    expect(cardMaxWidth(2400)).toBe(420);
    expect(cardMaxWidth(1000)).toBe(300);
  });
});
