import { describe, expect, it } from 'vitest';
import { focusScrollTop, listScrollTop, placedScrollTop } from './scrollPlacement';

// A pane 600 px tall over 20 px lines: a third of the way down is 200 px (the comments panel and the diff keep a third).
const PANE = 600;
const LINE = 20;
const LONG = 100_000;

describe('focusScrollTop', () => {
  it('puts the commented line a third of the way down, lines of context above it and its card below', () => {
    // Line at 5000, its card 200 tall: line at 5000 - 200.
    expect(focusScrollTop({ top: 5000, bottom: 5220, contextAbove: 3 * LINE, viewHeight: PANE, contentHeight: LONG })).toBe(4800);
  });

  it('scrolls on just enough for a tall card to fit below the line', () => {
    // Line at 5000 and a card ending at 5500: from 4800 it would end past 5400, so the view starts at 5500 - 600.
    expect(focusScrollTop({ top: 5000, bottom: 5500, contextAbove: 3 * LINE, viewHeight: PANE, contentHeight: LONG })).toBe(4900);
  });

  it('keeps three lines of context above the line however tall the card, cutting the card instead', () => {
    expect(focusScrollTop({ top: 5000, bottom: 6000, contextAbove: 3 * LINE, viewHeight: PANE, contentHeight: LONG })).toBe(5000 - 3 * LINE);
  });

  it('leaves a line near the top of the file at the top', () => {
    expect(focusScrollTop({ top: 60, bottom: 260, contextAbove: 3 * LINE, viewHeight: PANE, contentHeight: LONG })).toBe(0);
  });

  it('stops at the end of a line near the end of the file, and never scrolls a short one', () => {
    expect(focusScrollTop({ top: 9800, bottom: 9990, contextAbove: 3 * LINE, viewHeight: PANE, contentHeight: 10_000 })).toBe(10_000 - PANE);
    expect(focusScrollTop({ top: 300, bottom: 500, contextAbove: 3 * LINE, viewHeight: PANE, contentHeight: 520 })).toBe(0);
  });
});

describe('placedScrollTop', () => {
  it('puts an element a fifth down the viewport, on screen or not', () => {
    expect(placedScrollTop(2000, PANE, LONG)).toBe(2000 - PANE / 5);
    expect(placedScrollTop(400, PANE, LONG)).toBe(400 - PANE / 5);
  });

  it('puts the top of a card taller than two-thirds of the viewport a fifth down too, not bottom-aligned', () => {
    // A card taller than the viewport: its top, not its end, is what a reader needs.
    expect(placedScrollTop(5000, PANE, LONG)).toBe(5000 - PANE / 5);
  });

  it('never scrolls above the top, or past the end of the content', () => {
    expect(placedScrollTop(120, PANE, LONG)).toBe(0);
    expect(placedScrollTop(9900, PANE, 10_000)).toBe(10_000 - PANE);
    expect(placedScrollTop(300, PANE, 520)).toBe(0);
  });
});

describe('listScrollTop', () => {
  const view = { scrollTop: 1000, height: 600, contentHeight: 5000 };

  it("doesn't move the list when the card shows whole", () => {
    expect(listScrollTop({ top: 1100, bottom: 1200 }, view)).toBeNull();
  });

  it('puts a card below the view a third of the way down', () => {
    expect(listScrollTop({ top: 2000, bottom: 2080 }, view)).toBe(1800);
  });

  it('puts a card above the view a third of the way down too', () => {
    expect(listScrollTop({ top: 400, bottom: 480 }, view)).toBe(200);
  });

  it('keeps a tall card whole, its top higher', () => {
    expect(listScrollTop({ top: 2000, bottom: 2500 }, view)).toBe(1900);
  });

  it('stops at the start and the end of the list', () => {
    expect(listScrollTop({ top: 100, bottom: 180 }, view)).toBe(0);
    expect(listScrollTop({ top: 4900, bottom: 4980 }, view)).toBe(5000 - 600);
  });
});
