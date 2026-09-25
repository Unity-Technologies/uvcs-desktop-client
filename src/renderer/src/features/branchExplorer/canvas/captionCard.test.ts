import { describe, expect, it } from 'vitest';
import { CARD_BORDER, CARD_LINE_HEIGHT, CARD_PADDING_X, CARD_PADDING_Y, captionCardPosition, cardMaxWidth, keepInside } from './captionCard';

const metrics = { ascent: 11, descent: 3, middleToBaseline: 4 };

describe('captionCardPosition', () => {
  it('puts the first line of the card on the caption: same baseline, same first glyph', () => {
    const { left, top } = captionCardPosition({ x: 200, middle: 100 }, metrics, 12);
    expect(left + CARD_BORDER + CARD_PADDING_X).toBe(200);
    const halfLeading = (12 * CARD_LINE_HEIGHT - 14) / 2;
    expect(top + CARD_BORDER + CARD_PADDING_Y + halfLeading + metrics.ascent).toBe(104);
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
