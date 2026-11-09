import { describe, expect, it } from 'vitest';
import { focusScrollTop } from './scrollPlacement';

// A pane 600 px tall over 20 px lines: a third of the way down is 200 px.
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
